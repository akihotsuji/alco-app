import { type CSSProperties, useState } from "react";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { socialAvatarUrl } from "@/client/hooks/use-social.ts";
import {
  DEFAULT_MASCOT_COLOR,
  mascotLightColor,
  type SocialPublicProfile,
} from "@/shared/social.ts";

type SocialAvatarProps = {
  profile: Pick<
    SocialPublicProfile,
    "userId" | "avatarMode" | "mascotColor" | "hasCustomAvatar" | "nickname"
  >;
  size?: number;
};

export function SocialAvatar({ profile, size = 40 }: SocialAvatarProps) {
  const color = profile.mascotColor || DEFAULT_MASCOT_COLOR;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = profile.avatarMode === "uploaded" && profile.hasCustomAvatar && !imageFailed;
  if (showImage) {
    return (
      <img
        className="social-avatar-image"
        src={socialAvatarUrl(profile.userId)}
        alt=""
        width={size}
        height={size}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <span
      className="social-avatar-mascot"
      style={
        {
          width: size,
          height: size,
          "--mascot-wine": color,
          "--mascot-wine-light": mascotLightColor(color),
        } as CSSProperties
      }
    >
      <Mascot size={size} pose="default" aria-hidden />
    </span>
  );
}
