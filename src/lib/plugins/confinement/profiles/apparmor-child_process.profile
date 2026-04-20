# ainative plugin [child_process] capability — AppArmor profile stub (M3)
#
# Minimal baseline: allow fork/exec. Real per-plugin binary whitelist is M3.5.
#
# Install with: sudo apparmor_parser -r /etc/apparmor.d/ainative-plugin-child_process
# TODO(M3.5): enforce Px transitions for allowed binaries only.

profile ainative-plugin-child_process {
  # stdio
  /dev/null rw,
  /dev/zero r,
  /dev/urandom r,

  # read-only filesystem
  /usr/** r,
  /lib/** r,
  /lib64/** r,

  # fork + exec common interpreters
  /usr/bin/* ix,
  /usr/local/bin/* ix,

  # state dir
  owner @{HOME}/.ainative/plugins/*/state/** rw,

  # no network by default
  deny network,
}
