# ainative plugin [net] capability — AppArmor profile stub (M3)
#
# Minimal baseline: allow network, allow stdio, deny fs writes outside
# ~/.ainative/plugins/*/state. Real per-host/per-port allowlist is M3.5.
#
# Install with: sudo apparmor_parser -r /etc/apparmor.d/ainative-plugin-net
# TODO(M3.5): harden to deny-default + explicit tcp/udp allow rules.

profile ainative-plugin-net {
  # stdio
  /dev/null rw,
  /dev/zero r,
  /dev/urandom r,

  # read-only filesystem
  /usr/** r,
  /lib/** r,
  /lib64/** r,
  /etc/ssl/** r,

  # network
  network tcp,
  network udp,

  # state dir
  owner @{HOME}/.ainative/plugins/*/state/** rw,
}
