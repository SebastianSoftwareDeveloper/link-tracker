import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty, IsOptional, IsString, IsISO8601 } from 'class-validator'; // Importa IsISO8601

export class CreateLinkDto {
  /**
   * Property: url
   **/
  @ApiProperty({
    description: 'La URL original que se desea acortar.',
    example: 'https://infobae.com',
  })
  @IsUrl({}, { message: 'La URL proporcionada no es válida.' })
  @IsNotEmpty({ message: 'La URL original no puede estar vacía.' })
  url: string;

  /**
   * Property: password (optional)
   **/
  @ApiProperty({
    description: 'Contraseña opcional para proteger el link. Si se proporciona, el link requerirá esta contraseña para acceder.',
    example: '1234',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  password?: string;

  /**
   * Property: expiredAt (optional)
   **/
  @ApiProperty({
    description: 'Fecha y hora de expiración opcional para el link (formato ISO 8601 con zona horaria, ej. 2025-07-10T23:59:59-03:00 o 2025-07-10T23:59:59Z). Después de esta fecha, el link no será accesible.',
    example: '2025-07-10T23:59:59+00:00',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La fecha de expiración debe ser una cadena de texto.' })
  @IsISO8601({ strict: true }, { message: 'El formato de la fecha de expiración debe ser ISO 8601 (ej. 2025-07-10T23:59:59-03:00 o 2025-07-10T23:59:59Z).' }) // Validar formato ISO 8601
  expiredAt?: string;
}