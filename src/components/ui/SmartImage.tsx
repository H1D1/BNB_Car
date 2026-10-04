import Image, { type ImageProps } from "next/image";

// Hosts whose images can't be fetched by the server-side optimizer (bot protection),
// so they're loaded directly by the visitor's browser instead.
const DIRECT_HOSTS = ["content.avito.ma"];

/** Drop-in replacement for next/image that bypasses optimization for DIRECT_HOSTS. */
export default function SmartImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  const direct = DIRECT_HOSTS.some((h) => src.includes(h));
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through props
  return <Image {...props} unoptimized={direct || props.unoptimized} referrerPolicy={direct ? "no-referrer" : props.referrerPolicy} />;
}
