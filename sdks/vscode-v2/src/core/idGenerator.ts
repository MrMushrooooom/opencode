/**
 * ID generation utilities for OpenCode application
 * 
 * Generates unique identifiers for messages, parts, and sessions using a combination
 * of timestamp, counter, and random suffix. The format ensures chronological ordering
 * via string comparison while maintaining uniqueness across concurrent operations.
 * 
 * Format: {prefix}_{timestampHex}{randomBase62}
 * - prefix: message type identifier (msg, prt, ses)
 * - timestampHex: 12-character hex representation of timestamp + counter
 * - randomBase62: 14-character random string (0-9, A-Z, a-z)
 */
export class IdGenerator {
  private static lastTimestamp = 0
  private static counter = 0

  /**
   * Generate unique message ID
   * Format: msg_{timestampHex}{randomBase62}
   */
  static generateMessageId(): string {
    return this.generateID('msg')
  }

  /**
   * Generate unique part ID
   * Format: prt_{timestampHex}{randomBase62}
   */
  static generatePartId(): string {
    return this.generateID('prt')
  }

  /**
   * Generate unique session ID
   * Format: ses_{timestampHex}{randomBase62}
   */
  static generateSessionId(): string {
    return this.generateID('ses')
  }

  /**
   * Generate unique ID with specified prefix
   * 
   * Uses timestamp + counter for chronological ordering and random suffix for uniqueness.
   * The counter ensures uniqueness within the same millisecond.
   * 
   * @param prefix - Identifier prefix (msg, prt, ses)
   * @returns Unique ID string
   */
  private static generateID(prefix: string): string {
    const currentTimestamp = Date.now()
    
    // Reset counter when timestamp changes
    if (currentTimestamp !== this.lastTimestamp) {
      this.lastTimestamp = currentTimestamp
      this.counter = 0
    }
    this.counter++
    
    // Combine timestamp and counter into a single BigInt
    const now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(this.counter)
    
    // Convert to 12-character hex string
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }
    const timeHex = timeBytes.toString('hex')
    
    // Append random base62 suffix for additional uniqueness
    const randomBase62 = this.randomBase62(14)
    
    return `${prefix}_${timeHex}${randomBase62}`
  }

  /**
   * Generate random base62 string
   * 
   * Uses characters 0-9, A-Z, a-z (62 total characters) for URL-safe random strings.
   * 
   * @param length - Desired string length
   * @returns Random base62 string
   */
  private static randomBase62(length: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * 62)]
    }
    return result
  }
}

