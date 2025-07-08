import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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
    description: 'Fecha y hora de expiración opcional para el link (YYYY-MM-DD HH:MM:SS). Después de esta fecha, el link no será accesible.',
    example: '2025-07-10 23:59:59',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La fecha de expiración debe ser una cadena de texto.' })
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, {
    message: 'El formato de la fecha de expiración debe ser YYYY-MM-DD HH:MM:SS.',
  })
  expiredAt?: string;
}