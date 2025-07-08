import { Controller, Post, Get, Body, Param, Res, HttpStatus, NotFoundException, Put, BadRequestException, Query, UnauthorizedException } from '@nestjs/common';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { LinkResponseDto } from './dto/link-response.dto';
import { LinkStatsDto } from './dto/link-stats.dto';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('links')
@Controller()
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Crea un nuevo link acortado.
   * @param createLinkDto El DTO con la URL original, contraseña y fecha de expiración.
   * @returns Un objeto con la URL original (target), la URL acortada (link) y un indicador de validez.
   */
  @Post('create')
  @ApiOperation({ summary: 'Crea un nuevo link acortado.' })
  @ApiBody({ type: CreateLinkDto, description: 'La URL original para acortar, con opciones de contraseña y expiración.' })
  @ApiResponse({
    status: 201,
    description: 'El link ha sido creado exitosamente.',
    type: LinkResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Solicitud inválida (ej. URL no válida o formato de fecha incorrecto).' })
  createLink(@Body() createLinkDto: CreateLinkDto): LinkResponseDto {
    const newLink = this.linksService.create(createLinkDto);

    const baseUrl = this.configService.get<string>('URL');
    const shortUrl = `${baseUrl}/l/${newLink.shortCode}`;

    return {
      target: newLink.originalUrl,
      link: shortUrl,
      valid: true,
    };
  }

  /**
   * Redirecciona al link original asociado a un código corto.
   * @param shortCode El código corto del link.
   * @param res El objeto de respuesta de Express para manejar la redirección.
   * @param password Contraseña proporcionada en el query param (opcional).
   */
  @Get('l/:shortCode')
  @ApiOperation({
    summary: 'Redirecciona al link original usando un código corto.',
    description: 'Redirecciona a la URL original. Si el link no se encuentra, ha sido invalidado, ha expirado o la contraseña es incorrecta/no proporcionada, se retornará un error 404 o 401.'
  })
  @ApiParam({
    name: 'shortCode',
    description: 'El código corto del link a redireccionar.',
    example: 'abcXYZ',
  })
  @ApiQuery({
    name: 'password',
    required: false,
    type: String,
    description: 'Contraseña para acceder a links protegidos.',
    example: '1234',
  })
  @ApiResponse({ status: 302, description: 'Redirección exitosa a la URL original (Este caso probar en el navegador).' })
  @ApiResponse({ status: 404, description: 'Link no encontrado, invalidado o expirado.' })
  @ApiResponse({ status: 401, description: 'Contraseña incorrecta o no proporcionada para un link protegido.' })
  async redirectToOriginalUrl(
    @Param('shortCode') shortCode: string,
    @Res() res: Response, // <--- CORRECCIÓN AQUÍ: 'res' movido antes de 'password?'
    @Query('password') password?: string,
  ) {
    try {
      const originalUrl = this.linksService.getOriginalUrlAndTrackClick(shortCode, password);
      res.redirect(HttpStatus.FOUND, originalUrl); // Comportamiento normal: redireccionar
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      } else if (error instanceof UnauthorizedException) { // Manejar error de contraseña
        res.status(HttpStatus.UNAUTHORIZED).json({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: error.message,
        });
      }
      else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Ocurrió un error interno.',
        });
      }
    }
  }

  /**
   * Invalida un link dado su código corto.
   * @param shortCode El código corto del link a invalidar.
   * @returns Un mensaje de éxito o error.
   */
  @Put('l/:shortCode')
  @ApiOperation({ summary: 'Invalida un link existente dado su código corto.' })
  @ApiParam({
    name: 'shortCode',
    description: 'El código corto del link a invalidar.',
    example: 'abcXYZ',
  })
  @ApiResponse({ status: 200, description: 'Link invalidado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Link no encontrado para el código corto proporcionado.' })
  @ApiResponse({ status: 400, description: 'El link ya estaba invalidado.' })
  invalidateLink(@Param('shortCode') shortCode: string): { message: string } {
    try {
      this.linksService.invalidateLink(shortCode);
      return { message: `Link con código corto "${shortCode}" invalidado exitosamente.` };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error; // Relanzar la excepción para que NestJS la maneje y devuelva el código de estado correcto
      }
      throw new Error('Ocurrió un error interno al invalidar el link.'); // Error genérico
    }
  }

  /**
   * Retorna las estadísticas de un link dado su ID numérico.
   * @param id El ID numérico del link.
   * @returns Las estadísticas del link.
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Obtiene las estadísticas de un link por su ID.' })
  @ApiParam({
    name: 'id',
    description: 'El ID numérico del link para obtener estadísticas. En el orden que se crearon: 1, 2, 3, ..., n.',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas del link retornadas exitosamente.',
    type: LinkStatsDto,
  })
  @ApiResponse({ status: 404, description: 'Link no encontrado para el ID proporcionado.' })
  getLinkStats(@Param('id') id: number): LinkStatsDto {
    // Asegurarse de que el ID sea un número
    const linkId = Number(id);
    if (isNaN(linkId)) {
      throw new NotFoundException('El ID del link debe ser un número válido.');
    }
    return this.linksService.getStats(linkId);
  }
}
