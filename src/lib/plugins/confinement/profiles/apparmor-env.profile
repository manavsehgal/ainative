# ainative plugin [env] capability — AppArmor profile stub (M3)
#
# Minimal baseline: allow env file reads commonly needed by CLIs. The
# declarative env allowlist is enforced at the wrap layer (env filtering),
# not in AppArmor directly. Real per-plugin allowlist is M3.5 follow-up.
#
# Install with: sudo apparmor_parser -r /etc/apparmor.d/ainative-plugin-env
# TODO(M3.5): add per-plugin env var whitelist at wrap layer.

profile ainative-plugin-env {
  # stdio
  /dev/null rw,
  /dev/zero r,
  /dev/urandom r,

  # env-related reads
  /etc/environment r,
  /etc/profile r,
  /etc/profile.d/** r,

  # read-only filesystem
  /usr/** r,
  /lib/** r,
  /lib64/** r,

  # state dir
  owner @{HOME}/.ainative/plugins/*/state/** rw,

  deny network,
}
