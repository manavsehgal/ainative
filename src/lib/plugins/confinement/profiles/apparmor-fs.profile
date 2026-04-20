# ainative plugin [fs] capability — AppArmor profile stub (M3)
#
# Minimal baseline: allow process stdio, allow fs read, write only under the
# plugin's state subdir. Real per-plugin allowlist corpus is M3.5 follow-up.
#
# Install with: sudo apparmor_parser -r /etc/apparmor.d/ainative-plugin-fs
# TODO(M3.5): narrow read scope to /usr/** + plugin subpath only.

profile ainative-plugin-fs {
  # stdio
  /dev/null rw,
  /dev/zero r,
  /dev/urandom r,

  # read-only filesystem
  /usr/** r,
  /lib/** r,
  /lib64/** r,

  # writable state dir
  owner @{HOME}/.ainative/plugins/*/state/** rw,

  # no network by default
  deny network,
}
