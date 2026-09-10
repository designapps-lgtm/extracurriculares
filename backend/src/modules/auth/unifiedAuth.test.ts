import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "../../db/domain";

const mocks = vi.hoisted(() => ({
  getUsersByEmail: vi.fn(),
  verifyIdToken: vi.fn(),
  issueAuthSession: vi.fn(),
  clearAllAuthCookies: vi.fn(),
  renewRoleSession: vi.fn(),
  refreshCookieForRole: vi.fn(),
}));

vi.mock("../../config", () => ({
  config: {
    googleClientId: "google-client-id.apps.example",
    googleInstitutionDomain: "gi.edu.co",
  },
}));

vi.mock("../../utils/googleOAuth", () => ({
  googleOAuthClient: { verifyIdToken: mocks.verifyIdToken },
}));

vi.mock("../../db/domain", () => ({
  getUsersByEmail: mocks.getUsersByEmail,
}));

vi.mock("./session", () => ({
  clearAllAuthCookies: mocks.clearAllAuthCookies,
  issueAuthSession: mocks.issueAuthSession,
  refreshCookieForRole: mocks.refreshCookieForRole,
  renewRoleSession: mocks.renewRoleSession,
}));

import { googleLogin, resolveRoleByEmail } from "./unifiedAuth";

function appUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    role: "teacher",
    code: "T-1",
    email: "teacher@gi.edu.co",
    firstName: "Ada",
    lastName: "Lovelace",
    photoUrl: null,
    status: "activo",
    active: true,
    permissions: {
      canViewStudents: true,
      canManageNews: false,
      canManageAttendance: true,
      canManageSchedules: true,
      canAdministerUsers: false,
    },
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function responseDouble(): { response: Response; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  return { response: { json } as unknown as Response, json };
}

describe("autenticación unificada con Google y Usuarios_Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "teacher@gi.edu.co",
        email_verified: true,
        hd: "gi.edu.co",
      }),
    });
  });

  it("inicia sesión con el rol prioritario y conserva permisos de AppSheet", async () => {
    const teacher = appUser();
    const admin = appUser({
      id: "admin-1",
      role: "admin",
      email: teacher.email,
      permissions: {
        canViewStudents: true,
        canManageNews: true,
        canManageAttendance: true,
        canManageSchedules: true,
        canAdministerUsers: true,
      },
    });
    mocks.getUsersByEmail.mockResolvedValue([teacher, admin]);
    const { response, json } = responseDouble();
    const request = { body: { credential: "valid-google-id-token" } } as Request;

    await googleLogin(request, response);

    expect(mocks.verifyIdToken).toHaveBeenCalledWith({
      idToken: "valid-google-id-token",
      audience: "google-client-id.apps.example",
    });
    expect(mocks.getUsersByEmail).toHaveBeenCalledWith("teacher@gi.edu.co", { fresh: true });
    expect(mocks.issueAuthSession).toHaveBeenCalledWith(response, admin);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        role: "admin",
        user: {
          id: "admin-1",
          nombre: "Ada",
          apellido: "Lovelace",
          email: "teacher@gi.edu.co",
          permissions: admin.permissions,
        },
      },
    });
  });

  it("rechaza un correo que no está registrado", async () => {
    mocks.getUsersByEmail.mockResolvedValue([]);

    await expect(resolveRoleByEmail("unknown@gi.edu.co")).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rechaza una cuenta inactiva", async () => {
    mocks.getUsersByEmail.mockResolvedValue([appUser({ active: false, status: "inactivo" })]);

    await expect(resolveRoleByEmail("teacher@gi.edu.co")).rejects.toMatchObject({
      statusCode: 403,
      code: "TEACHER_INACTIVE",
    });
  });

  it("rechaza credenciales de Google inválidas con un error estable", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("provider detail"));
    const { response } = responseDouble();

    await expect(googleLogin(
      { body: { credential: "invalid" } } as Request,
      response,
    )).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_GOOGLE_TOKEN",
      message: "La credencial de Google es inválida o expiró",
    });
  });
});
