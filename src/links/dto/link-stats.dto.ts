import { ApiProperty } from '@nestjs/swagger';

export class LinkStatsDto {
  /**
   * Property: id
   **/
  @ApiProperty({ description: 'El ID numérico único del link.' })
  id: number;

  /**
   * Property: originalUrl
   **/
  @ApiProperty({ description: 'La URL original del link.' })
  originalUrl: string;

  /**
   * Property: shortCode
   **/
  @ApiProperty({ description: 'El código corto del link.' })
  shortCode: string;

  /**
   * Property: clicks
   **/
  @ApiProperty({ description: 'El número total de clicks en este link.' })
  clicks: number;

  /**
   * Property: createdAt
   **/
  @ApiProperty({ description: 'La fecha y hora de creación del link.' })
  createdAt: Date;

  /**
   * Property: valid
   **/
  @ApiProperty({ description: 'Indica si el link está actualmente válido (true) o invalidado (false).' })
  valid: boolean;

  /**
   * Property: expiredAt
   **/
  @ApiProperty({
    description: 'La fecha y hora en que el link expirará, si fue configurada.',
    example: '2025-12-31T23:59:59.000Z',
    nullable: true,
  })
  expiredAt: Date | null;

  /**
   * Property: hasPassword
   **/
  @ApiProperty({
    description: 'Indica si el link está protegido con una contraseña.',
    example: true,
  })
  hasPassword: boolean;
}