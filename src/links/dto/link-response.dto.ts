import { ApiProperty } from '@nestjs/swagger';

export class LinkResponseDto {
  /**
   * Property: target
   **/
  @ApiProperty({ description: 'La URL que fue acortada.', example: 'https://google.com' })
  target: string;

  /**
   * Property: link
   **/
  @ApiProperty({ description: 'La URL acortada completa.', example: 'http://localhost:8080/l/absJu' })
  link: string;

  /**
   * Property: valid
   **/
  @ApiProperty({ description: 'Indica si la operación fue exitosa.', example: true })
  valid: boolean;
}