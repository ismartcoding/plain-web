enum ApplyToType {
  ALL = 'all',
  DEVICE = 'mac',
  TAG = 'tag',
  INTERFACE = 'iface',
}

export class ApplyTo {
  type: ApplyToType = ApplyToType.ALL
  value = ''

  parse(raw: string) {
    const index = raw.indexOf(':')
    if (index === -1) {
      this.type = raw as ApplyToType
    } else {
      this.type = raw.slice(0, index) as ApplyToType
      this.value = raw.slice(index + 1)
    }
  }

  getText(t: Function, devices: any, networks: any): string {
    let r = ''
    switch (this.type) {
      case ApplyToType.ALL:
        r = t('all_devices')
        break
      case ApplyToType.DEVICE:
        r = devices.find((it: any) => it.mac === this.value)?.name ?? this.value
        break
      case ApplyToType.INTERFACE:
        r = networks.find((it: any) => it.ifName == this.value)?.name ?? this.value
        break
    }
    return r
  }

  toValue(): string {
    if (this.type == ApplyToType.ALL) {
      return this.type
    }

    return `${this.type}:${this.value}`
  }
}
