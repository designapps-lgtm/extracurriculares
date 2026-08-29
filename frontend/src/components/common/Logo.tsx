import type { ComponentPropsWithoutRef } from "react";

type LogoProps = ComponentPropsWithoutRef<"img"> & {
  chip?: boolean;
};

export default function Logo({
  chip = false,
  className = "h-8 w-auto",
  alt = "Extracurriculares",
  ...rest
}: LogoProps) {
  const img = <img src="/logo.png" alt={alt} className={`${className} block`} {...rest} />;
  if (!chip) return img;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1 leading-none shadow-sm">
      {img}
    </span>
  );
}