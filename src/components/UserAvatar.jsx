import { getInitials } from "../utils/profile"

function UserAvatar({ src, name, size = "md", className = "" }) {
  const classes = `user-avatar user-avatar-${size} ${className}`.trim()

  if (src) {
    return <img className={classes} src={src} alt="" />
  }

  return (
    <span className={`${classes} user-avatar-fallback`} aria-hidden="true">
      {getInitials(name)}
    </span>
  )
}

export default UserAvatar
