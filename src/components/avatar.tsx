import { initials } from "@/lib/format";

export function Avatar({
  name,
  email,
  image,
  size = 28,
}: {
  name: string | null | undefined;
  email: string;
  image: string | null | undefined;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full bg-neutral-200 object-cover"
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800"
      style={style}
    >
      {initials(name, email)}
    </span>
  );
}
