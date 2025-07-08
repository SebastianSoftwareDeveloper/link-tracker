import { Test, TestingModule } from '@nestjs/testing';
import { LinksService } from './links.service';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';

describe('LinksService', () => {
  let service: LinksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LinksService],
    }).compile();

    service = module.get<LinksService>(LinksService);

    (service as any)['links'] = [];
    (service as any)['nextId'] = 1;

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Prueba para asegurar que el servicio se define correctamente
  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // --- Pruebas para el método create ---
  describe('crear', () => {
    it('debería crear un link sin contraseña ni fecha de expiración', () => {
      const createDto: CreateLinkDto = { url: 'https://example.com/sin-pass' };
      const link = service.create(createDto);

      expect(link).toBeDefined();
      expect(link.originalUrl).toBe(createDto.url);
      expect(link.shortCode).toBeDefined();
      expect(link.clicks).toBe(0);
      expect(link.valid).toBe(true);
      expect(link.password).toBeUndefined();
      expect(link.expiredAt).toBeUndefined();
    });

    it('debería crear un link con contraseña', () => {
      const createDto: CreateLinkDto = { url: 'https://example.com/con-pass', password: 'securePassword' };
      const link = service.create(createDto);

      expect(link).toBeDefined();
      expect(link.originalUrl).toBe(createDto.url);
      expect(link.password).toBe('securePassword');
      expect(link.expiredAt).toBeUndefined();
    });

    it('debería crear un link con fecha de expiración', () => {
      const expirationDate = '2030-01-01 10:00:00';
      const createDto: CreateLinkDto = { url: 'https://example.com/con-exp', expiredAt: expirationDate };
      const link = service.create(createDto);

      expect(link).toBeDefined();
      expect(link.originalUrl).toBe(createDto.url);
      expect(link.password).toBeUndefined();
      expect(link.expiredAt).toEqual(new Date(expirationDate.replace(' ', 'T')));
    });

    it('debería crear un link con contraseña y fecha de expiración', () => {
      const expirationDate = '2030-01-01 10:00:00';
      const createDto: CreateLinkDto = {
        url: 'https://example.com/todas-las-caracteristicas',
        password: 'superSecure',
        expiredAt: expirationDate,
      };
      const link = service.create(createDto);

      expect(link).toBeDefined();
      expect(link.originalUrl).toBe(createDto.url);
      expect(link.password).toBe('superSecure');
      expect(link.expiredAt).toEqual(new Date(expirationDate.replace(' ', 'T')));
    });
  });

  // --- Pruebas para el método getOriginalUrlAndTrackClick ---
  describe('getOriginalUrlAndTrackClick', () => {
    let testLinkShortCode: string;
    let testLinkOriginalUrl: string;

    beforeEach(() => {
      const createDto: CreateLinkDto = { url: 'https://example.com/redireccionar' };
      const link = service.create(createDto);
      testLinkShortCode = link.shortCode;
      testLinkOriginalUrl = link.originalUrl;
    });

    it('debería retornar la URL original para un link válido y registrar el click', () => {
      const originalUrl = service.getOriginalUrlAndTrackClick(testLinkShortCode);
      expect(originalUrl).toBe(testLinkOriginalUrl);
      const linkStats = service.getStats(1);
      expect(linkStats.clicks).toBe(1);
    });

    it('debería lanzar NotFoundException para un link inexistente', () => {
      expect(() => service.getOriginalUrlAndTrackClick('inexistente')).toThrow(NotFoundException);
      expect(() => service.getOriginalUrlAndTrackClick('inexistente')).toThrow('Link con código corto "inexistente" no encontrado.');
    });

    it('debería lanzar NotFoundException si el link es inválido', () => {
      service.invalidateLink(testLinkShortCode);
      expect(() => service.getOriginalUrlAndTrackClick(testLinkShortCode)).toThrow(NotFoundException);
      expect(() => service.getOriginalUrlAndTrackClick(testLinkShortCode)).toThrow(`Link con código corto "${testLinkShortCode}" ha sido invalidado y no se puede redireccionar.`);
    });

    it('debería lanzar NotFoundException si el link ha expirado', () => {
      // Definir una fecha de expiración en la zona horaria LOCAL del ambiente de prueba.
      // Esta fecha será la que el servicio interpretará cuando cree el link.
      const localExpirationDate = new Date();
      localExpirationDate.setFullYear(localExpirationDate.getFullYear() - 1);
      localExpirationDate.setSeconds(localExpirationDate.getSeconds() + 5);

      // Formatear esta fecha LOCAL para el DTO.
      // El servicio la parseará como una fecha local.
      const formatNumber = (num: number) => num.toString().padStart(2, '0');
      const expiredAtString = `${localExpirationDate.getFullYear()}-${formatNumber(localExpirationDate.getMonth() + 1)}-${formatNumber(localExpirationDate.getDate())} ${formatNumber(localExpirationDate.getHours())}:${formatNumber(localExpirationDate.getMinutes())}:${formatNumber(localExpirationDate.getSeconds())}`;

      // Establecer el tiempo del sistema (falso) a un momento ANTES de la expiración LOCAL.
      // Esto es crucial para que el link se cree como NO expirado inicialmente.
      jest.setSystemTime(new Date(localExpirationDate.getTime() - 1000));

      // Crear el link. Su 'expiredAt' se basará en la interpretación LOCAL de 'expiredAtString'.
      const expiredLinkDto: CreateLinkDto = {
        url: 'https://example.com/expirado-local-tz',
        expiredAt: expiredAtString,
      };
      const expiredLink = service.create(expiredLinkDto);

      // Avanzar el tiempo del sistema (falso) a un momento CLARAMENTE después de la expiración LOCAL.
      // 'new Date()' en el servicio usará este tiempo falso.
      jest.setSystemTime(new Date(localExpirationDate.getTime() + 1000));
 
      // Ahora, la comparación 'new Date() > expiredLink.expiredAt' debería ser verdadera.
      expect(() => service.getOriginalUrlAndTrackClick(expiredLink.shortCode)).toThrow(NotFoundException);
      expect(() => service.getOriginalUrlAndTrackClick(expiredLink.shortCode)).toThrow(`Link con código corto "${expiredLink.shortCode}" ha expirado y no se puede redireccionar.`);
    });

    it('debería retornar la URL original para un link protegido con contraseña correcta', () => {
      const passwordProtectedDto: CreateLinkDto = { url: 'https://example.com/protegido', password: 'correcta' };
      const protectedLink = service.create(passwordProtectedDto);

      const originalUrl = service.getOriginalUrlAndTrackClick(protectedLink.shortCode, 'correcta');
      expect(originalUrl).toBe(protectedLink.originalUrl);
    });

    it('debería lanzar UnauthorizedException para un link protegido con contraseña incorrecta', () => {
      const passwordProtectedDto: CreateLinkDto = { url: 'https://example.com/protegido', password: 'correcta' };
      const protectedLink = service.create(passwordProtectedDto);

      expect(() => service.getOriginalUrlAndTrackClick(protectedLink.shortCode, 'incorrecta')).toThrow(UnauthorizedException);
      expect(() => service.getOriginalUrlAndTrackClick(protectedLink.shortCode, 'incorrecta')).toThrow('Contraseña incorrecta o no proporcionada para este link.');
    });

    it('debería lanzar UnauthorizedException para un link protegido sin proporcionar contraseña', () => {
      const passwordProtectedDto: CreateLinkDto = { url: 'https://example.com/protegido', password: 'correcta' };
      const protectedLink = service.create(passwordProtectedDto);

      expect(() => service.getOriginalUrlAndTrackClick(protectedLink.shortCode)).toThrow(UnauthorizedException);
      expect(() => service.getOriginalUrlAndTrackClick(protectedLink.shortCode)).toThrow('Contraseña incorrecta o no proporcionada para este link.');
    });
  });

  // --- Pruebas para el método invalidateLink ---
  describe('invalidarLink', () => {
    let linkToInvalidateShortCode: string;

    beforeEach(() => {
      const createDto: CreateLinkDto = { url: 'https://example.com/a-invalidar' };
      const link = service.create(createDto);
      linkToInvalidateShortCode = link.shortCode;
    });

    it('debería invalidar un link válido existente', () => {
      const invalidatedLink = service.invalidateLink(linkToInvalidateShortCode);
      expect(invalidatedLink.valid).toBe(false);
      const linkStats = service.getStats(invalidatedLink.id);
      expect(linkStats.valid).toBe(false);
    });

    it('debería lanzar NotFoundException al invalidar un link inexistente', () => {
      expect(() => service.invalidateLink('inexistente')).toThrow(NotFoundException);
      expect(() => service.invalidateLink('inexistente')).toThrow('Link con código corto "inexistente" no encontrado.');
    });

    it('debería lanzar BadRequestException si el link ya es inválido', () => {
      service.invalidateLink(linkToInvalidateShortCode);
      expect(() => service.invalidateLink(linkToInvalidateShortCode)).toThrow(BadRequestException);
      expect(() => service.invalidateLink(linkToInvalidateShortCode)).toThrow(`El link con código corto "${linkToInvalidateShortCode}" ya está invalidado.`);
    });
  });

  // --- Pruebas para el método getStats ---
  describe('getStats', () => {
    let createdLink;
    let passwordProtectedLink;
    let expiredLink;

    beforeEach(() => {
      createdLink = service.create({ url: 'https://example.com/stats1' });
      passwordProtectedLink = service.create({ url: 'https://example.com/stats2', password: 'pass' });
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expiredLink = service.create({ url: 'https://example.com/stats3', expiredAt: futureDate.toISOString().slice(0, 19).replace('T', ' ') });
      service.invalidateLink(createdLink.shortCode);
    });

    it('debería retornar estadísticas para un link existente (invalidado)', () => {
      const stats = service.getStats(createdLink.id);
      expect(stats).toBeDefined();
      expect(stats.id).toBe(createdLink.id);
      expect(stats.originalUrl).toBe(createdLink.originalUrl);
      expect(stats.valid).toBe(false);
      expect(stats.hasPassword).toBe(false);
      expect(stats.expiredAt).toBeNull();
    });

    it('debería retornar estadísticas para un link protegido con contraseña', () => {
      const stats = service.getStats(passwordProtectedLink.id);
      expect(stats).toBeDefined();
      expect(stats.id).toBe(passwordProtectedLink.id);
      expect(stats.hasPassword).toBe(true);
      expect(stats.expiredAt).toBeNull();
    });

    it('debería retornar estadísticas para un link con fecha de expiración', () => {
      const stats = service.getStats(expiredLink.id);
      expect(stats).toBeDefined();
      expect(stats.id).toBe(expiredLink.id);
      expect(stats.expiredAt).toEqual(expiredLink.expiredAt);
      expect(stats.hasPassword).toBe(false);
    });

    it('debería lanzar NotFoundException al obtener estadísticas de un link inexistente', () => {
      expect(() => service.getStats(999)).toThrow(NotFoundException);
      expect(() => service.getStats(999)).toThrow('Link con ID "999" no encontrado.');
    });
  });
});
