import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "../appsheet/appsheet.domain";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  clearAuthCookies: vi.fn(),
  setAuthCookies: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("../../config", () => ({
  config: {
    jwtSecret: "test-jwt-secret-with-enough-entropy",
    accessTokenExpiresIn: "15m",
    sessionDurationHours: 168,
  },
}));

vi.mock("../../utils/originGuard", () => ({
  assertTrustedOrigin: mocks.assertTrustedOrigin,
}));

vi.mock("../../utils/authCookies", () => ({
  ADMIN_REFRESH_COOKIE: "admin_refresh",
  SECRETARY_REFRESH_COOKIE: "secretary_refresh",
  SUPERVISOR_REFRESH_COOKIE: "supervisor_refresh",
  TEACHER_REFRESH_COOKIE: "teacher_refresh",
  clearAuthCookies: mocks.clearAuthCookies,
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock("../appsheet/appsheet.domain", () => ({
  getUserById: mocks.getUserById,
}));

import {
  renewRoleSession,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from "./session";

function appUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "teacher-1",
    role: "teacher",
    code: "T-1",
    email: "teacher@gi.edu.co",
    firstName: "Grace",
    lastName: "Hopper",
    photoUrl: null,
    status: "activo",
    active: true,
    permissions: {
      canViewStudents: true,
      canManageNews: false,
      canManageAttendance: true,
      canManageSchedules: false,
      canAdministerUsers: false,
    },
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("sesiones JWT stateless", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("incluye rol, identidad y permisos en el access token", () => {
    const user = appUser();
    const claims = verifyAccessToken(signAccessToken(user), "teacher");

    expect(claims).toMatchObject({
      tokenType: "access",
      role: "teacher",
      userId: "teacher-1",
      teacherId: "teacher-1",
      email: "teacher@gi.edu.co",
      permissions: user.permissions,
    });
  });

  it("revalida la cuenta en AppSheet y rota ambos JWT durante refresh", async () => {
    const user = appUser();
    const refreshToken = signRefreshToken(user);
    const request = { cookies: { teacher_refresh: refreshToken } } as unknown as Request;
    const response = {} as Response;
    mocks.getUserById.mockResolvedValue(user);

    await expect(renewRoleSession(request, response, "teacher")).resolves.toBe(user);

    expect(mocks.assertTrustedOrigin).toHaveBeenCalledWith(request);
    expect(mocks.getUserById).toHaveBeenCalledWith("teacher-1", "teacher", { fresh: true });
    expect(mocks.setAuthCookies).toHaveBeenCalledWith(
      response,
      "teacher",
      expect.any(String),
      expect.any(String),
    );
  });

  it("invalida el refresh si la cuenta fue desactivada", async () => {
    const original = appUser();
    const request = {
      cookies: { teacher_refresh: signRefreshToken(original) },
    } as unknown as Request;
    const response = {} as Response;
    mocks.getUserById.mockResolvedValue(appUser({ active: false, status: "inactivo" }));

    await expect(renewRoleSession(request, response, "teacher")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(mocks.clearAuthCookies).toHaveBeenCalledWith(response, "teacher");
    expect(mocks.setAuthCookies).not.toHaveBeenCalled();
  });
});
