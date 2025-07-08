import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import { LinkStatsDto } from './dto/link-stats.dto';

interface Link {
  id: number;
  originalUrl: string;
  shortCode: string;
  clicks: number;
  createdAt: Date;
  valid: boolean;
  password?: string;
  expiredAt?: Date;
}

@Injectable()
export class LinksService {
  private links: Link[] = [];
  private nextId = 1;

  /**
   * Genera un código corto alfanumérico aleatorio.
   * @param length La longitud del código corto.
   * @returns Un string alfanumérico aleatorio.
   */
  private generateShortCode(length: number = 6): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    // Asegurarse de que el código sea único
    if (this.links.some(link => link.shortCode === result)) {
      return this.generateShortCode(length); // Regenerar si ya existe
    }
    return result;
  }

  /**
   * Crea un nuevo link acortado.
   * @param createLinkDto El DTO con la URL original, contraseña y fecha de expiración.
   * @returns El objeto link creado con su información.
   */
  create(createLinkDto: CreateLinkDto): Link {
    const shortCode = this.generateShortCode();
    const newLink: Link = {
      id: this.nextId++,
      originalUrl: createLinkDto.url,
      shortCode: shortCode,
      clicks: 0,
      createdAt: new Date(),
      valid: true,
    };

    if (createLinkDto.password) {
      newLink.password = createLinkDto.password;
    }

    if (createLinkDto.expiredAt) {
      // Convertir la cadena de fecha a un objeto Date
      newLink.expiredAt = new Date(createLinkDto.expiredAt.replace(' ', 'T')); // Formato ISO para Date
    }

    this.links.push(newLink);
    return newLink;
  }

  /**
   * Obtiene la URL original y registra un click para un código corto dado.
   * Valida la validez, la expiración y la contraseña del link.
   * @param shortCode El código corto del link.
   * @param password Contraseña proporcionada por el usuario (opcional).
   * @returns La URL original.
   * @throws NotFoundException Si el código corto no se encuentra o si el link ha sido invalidado/expirado.
   * @throws UnauthorizedException Si el link requiere contraseña y no se proporciona o es incorrecta.
   */
  getOriginalUrlAndTrackClick(shortCode: string, password?: string): string {
    const link = this.links.find(l => l.shortCode === shortCode);
    if (!link) {
      throw new NotFoundException(`Link con código corto "${shortCode}" no encontrado.`);
    }

    // Verificar si el link ha sido invalidado manualmente
    if (!link.valid) {
      throw new NotFoundException(`Link con código corto "${shortCode}" ha sido invalidado y no se puede redireccionar.`);
    }

    // Verificar la fecha de expiración
    if (link.expiredAt && new Date() > link.expiredAt) {
      throw new NotFoundException(`Link con código corto "${shortCode}" ha expirado y no se puede redireccionar.`);
    }

    // Verificar la contraseña
    if (link.password) {
      if (!password || password !== link.password) {
        throw new UnauthorizedException('Contraseña incorrecta o no proporcionada para este link.');
      }
    }

    link.clicks++;
    return link.originalUrl;
  }

  /**
   * Invalida un link dado su código corto.
   * @param shortCode El código corto del link a invalidar.
   * @returns El link invalidado.
   * @throws NotFoundException Si el código corto no se encuentra.
   * @throws BadRequestException Si el link ya estaba invalidado.
   */
  invalidateLink(shortCode: string): Link {
    const link = this.links.find(l => l.shortCode === shortCode);
    if (!link) {
      throw new NotFoundException(`Link con código corto "${shortCode}" no encontrado.`);
    }
    if (!link.valid) {
      throw new BadRequestException(`El link con código corto "${shortCode}" ya está invalidado.`);
    }
    link.valid = false;
    return link;
  }

  /**
   * Obtiene las estadísticas de un link por su ID.
   * @param id El ID numérico del link.
   * @returns Las estadísticas del link.
   * @throws NotFoundException Si el ID del link no se encuentra.
   */
  getStats(id: number): LinkStatsDto {
    const link = this.links.find(l => l.id === id);
    if (!link) {
      throw new NotFoundException(`Link con ID "${id}" no encontrado.`);
    }
    // Retornar un DTO para asegurar que solo se expongan los datos deseados
    return {
      id: link.id,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      valid: link.valid,
      expiredAt: link.expiredAt || null,
      hasPassword: !!link.password, // Indica si el link tiene una contraseña
    };
  }
}