import { isDomainWithOptionalPort, isIPWithOptionalPort, isNetWithOptionalPort, isPortOrPortRangeMultiple } from './validator'

export enum TargetType {
  IP = 'ip',
  NET = 'net',
  DNS = 'dns',
  REMOTE_PORT = 'remote_port',
  INTERNET = 'internet',
  INTERFACE = 'iface',
  LIST = 'list',
}

export class Target {
  type: TargetType = TargetType.DNS
  value = ''

  parse(raw: string) {
    const index = raw.indexOf(':')
    if (index === -1) {
      this.type = raw as TargetType
    } else {
      this.type = raw.slice(0, index) as TargetType
      this.value = raw.slice(index + 1)
    }
  }

  static hasInput(type: TargetType): boolean {
    return [TargetType.IP, TargetType.NET, TargetType.DNS, TargetType.REMOTE_PORT].includes(type)
  }

  static hint(type: TargetType): string {
    switch (type) {
      case TargetType.IP:
        return '10.10.10.2'
      case TargetType.NET:
        return '10.10.10.0/24'
      case TargetType.DNS:
        return 'example.com'
      case TargetType.REMOTE_PORT:
        return '1419'
    }

    return ''
  }

  static isValid(type: TargetType, value: string): boolean {
    switch (type) {
      case TargetType.IP:
        return isIPWithOptionalPort(value)
      case TargetType.NET:
        return isNetWithOptionalPort(value)
      case TargetType.DNS:
        return isDomainWithOptionalPort(value)
      case TargetType.REMOTE_PORT:
        return isPortOrPortRangeMultiple(value)
    }

    return true
  }

  getText(t: Function, networks: any): string {
    if (this.type == TargetType.INTERNET) {
      return t(`target_type.internet`)
    } else if (this.type == TargetType.INTERFACE) {
      if (!this.value) {
        return t('all_local_networks')
      } else {
        return networks.find((it: any) => it.ifName == this.value)?.name ?? this.value
      }
    } else if (this.type == TargetType.REMOTE_PORT) {
      return t('remote_port', { port: this.value })
    }

    return this.value
  }

  toValue(): string {
    if (!this.value || this.type === TargetType.INTERNET) {
      return this.type
    }

    return `${this.type}:${this.value}`
  }
}
