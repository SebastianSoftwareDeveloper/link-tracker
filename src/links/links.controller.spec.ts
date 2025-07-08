import { Test, TestingModule } from '@nestjs/testing';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { NotFoundException, BadRequestException, UnauthorizedException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

describe('LinksController', () => {
  let controller: LinksController;
  let service: LinksService;
  let configService: ConfigService;

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn(),
      getOriginalUrlAndTrackClick: jest.fn(),
      invalidateLink: jest.fn(),
      getStats: jest.fn(),
    };
  
    const configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'URL') {
          return process.env.URL;
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        {
          provide: LinksService,
          useValue: serviceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    controller = module.get<LinksController>(LinksController);
    service = module.get<LinksService>(LinksService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  // --- Pruebas para el método createLink (POST /create) ---
  describe('crearLink', () => {
    it('debería crear un link y retornar el formato de respuesta correcto', () => {
      const createDto = { url: 'https://test.com/nuevo' };
      const serviceResult = {
        id: 1,
        originalUrl: createDto.url,
        shortCode: 'abcXYZ',
        clicks: 0,
        createdAt: new Date(),
        valid: true,
      };
      (service.create as jest.Mock).mockReturnValue(serviceResult);

      const result = controller.createLink(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(configService.get).toHaveBeenCalledWith('URL');
      expect(result).toEqual({
        target: createDto.url,
        link: `${configService.get('URL')}/l/${serviceResult.shortCode}`,
        valid: true,
      });
    });
  });

  // --- Pruebas para el método redirectToOriginalUrl (GET /l/:shortCode) ---
  describe('redireccionarAUrlOriginal', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('debería redireccionar a la URL original para un link válido', async () => {
      const shortCode = 'linkValido';
      const originalUrl = 'https://original.com';
      (service.getOriginalUrlAndTrackClick as jest.Mock).mockReturnValue(originalUrl);

      await controller.redirectToOriginalUrl(shortCode, mockResponse as Response, undefined);

      expect(service.getOriginalUrlAndTrackClick).toHaveBeenCalledWith(shortCode, undefined);
      expect(mockResponse.redirect).toHaveBeenCalledWith(HttpStatus.FOUND, originalUrl);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('debería lanzar 404 si el link no se encuentra', async () => {
      const shortCode = 'inexistente';
      (service.getOriginalUrlAndTrackClick as jest.Mock).mockImplementation(() => {
        throw new NotFoundException(`Link con código corto "${shortCode}" no encontrado.`);
      });

      await controller.redirectToOriginalUrl(shortCode, mockResponse as Response, undefined);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Link con código corto "${shortCode}" no encontrado.`,
      });
    });

    it('debería lanzar 404 si el link es inválido', async () => {
      const shortCode = 'linkInvalido';
      (service.getOriginalUrlAndTrackClick as jest.Mock).mockImplementation(() => {
        throw new NotFoundException(`Link con código corto "${shortCode}" ha sido invalidado y no se puede redireccionar.`);
      });

      await controller.redirectToOriginalUrl(shortCode, mockResponse as Response, undefined);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Link con código corto "${shortCode}" ha sido invalidado y no se puede redireccionar.`,
      });
    });

    it('debería lanzar 404 si el link ha expirado', async () => {
      const shortCode = 'linkExpirado';
      (service.getOriginalUrlAndTrackClick as jest.Mock).mockImplementation(() => {
        throw new NotFoundException(`Link con código corto "${shortCode}" ha expirado y no se puede redireccionar.`);
      });

      await controller.redirectToOriginalUrl(shortCode, mockResponse as Response, undefined);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Link con código corto "${shortCode}" ha expirado y no se puede redireccionar.`,
      });
    });

    it('debería lanzar 401 si se requiere contraseña y es incorrecta', async () => {
      const shortCode = 'linkProtegido';
      const incorrectPassword = 'contraseñaIncorrecta';
      (service.getOriginalUrlAndTrackClick as jest.Mock).mockImplementation((sc, pass) => {
        if (pass !== 'contraseñaCorrecta') {
          throw new UnauthorizedException('Contraseña incorrecta o no proporcionada para este link.');
        }
        return 'https://original.com';
      });

      await controller.redirectToOriginalUrl(shortCode, mockResponse as Response, incorrectPassword);

      expect(service.getOriginalUrlAndTrackClick).toHaveBeenCalledWith(shortCode, incorrectPassword);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Contraseña incorrecta o no proporcionada para este link.',
      });
    });

    it('debería lanzar 401 si se requiere contraseña y no se proporciona', async () => {
      const shortCode = 'linkProtegido';
      (service.getOriginalUrlAndTrackClick as jest.Mock).mockImplementation((sc, pass) => {
        if (!pass) {
          throw new UnauthorizedException('Contraseña incorrecta o no proporcionada para este link.');
        }
        return 'https://original.com';
      });

      await controller.redirectToOriginalUrl(shortCode, mockResponse as Response, undefined);

      expect(service.getOriginalUrlAndTrackClick).toHaveBeenCalledWith(shortCode, undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Contraseña incorrecta o no proporcionada para este link.',
      });
    });
  });

  // --- Pruebas para el método invalidateLink (PUT /l/:shortCode) ---
  describe('invalidarLink', () => {
    it('debería invalidar un link exitosamente', () => {
      const shortCode = 'aInvalidar';
      (service.invalidateLink as jest.Mock).mockReturnValue({});

      const result = controller.invalidateLink(shortCode);

      expect(service.invalidateLink).toHaveBeenCalledWith(shortCode);
      expect(result).toEqual({ message: `Link con código corto "${shortCode}" invalidado exitosamente.` });
    });

    it('debería lanzar 404 si el link a invalidar no se encuentra', () => {
      const shortCode = 'inexistente';
      (service.invalidateLink as jest.Mock).mockImplementation(() => {
        throw new NotFoundException(`Link con código corto "${shortCode}" no encontrado.`);
      });

      expect(() => controller.invalidateLink(shortCode)).toThrow(NotFoundException);
      expect(() => controller.invalidateLink(shortCode)).toThrow(`Link con código corto "${shortCode}" no encontrado.`);
    });

    it('debería lanzar 400 si el link ya es inválido', () => {
      const shortCode = 'yaInvalido';
      (service.invalidateLink as jest.Mock).mockImplementation(() => {
        throw new BadRequestException(`El link con código corto "${shortCode}" ya está invalidado.`);
      });

      expect(() => controller.invalidateLink(shortCode)).toThrow(BadRequestException);
      expect(() => controller.invalidateLink(shortCode)).toThrow(`El link con código corto "${shortCode}" ya está invalidado.`);
    });
  });

  // --- Pruebas para el método getLinkStats (GET /:id/stats) ---
  describe('obtenerEstadisticasLink', () => {
    it('debería retornar estadísticas del link para un ID válido', () => {
      const linkId = 1;
      const statsResult = {
        id: linkId,
        originalUrl: 'https://stats.com',
        shortCode: 'stats1',
        clicks: 5,
        createdAt: new Date(),
        valid: true,
        expiredAt: null,
        hasPassword: false,
      };
      (service.getStats as jest.Mock).mockReturnValue(statsResult);

      const result = controller.getLinkStats(linkId);

      expect(service.getStats).toHaveBeenCalledWith(linkId);
      expect(result).toEqual(statsResult);
    });

    it('debería lanzar 404 si las estadísticas para un ID inexistente', () => {
      const linkId = 999;
      (service.getStats as jest.Mock).mockImplementation(() => {
        throw new NotFoundException(`Link con ID "${linkId}" no encontrado.`);
      });

      expect(() => controller.getLinkStats(linkId)).toThrow(NotFoundException);
      expect(() => controller.getLinkStats(linkId)).toThrow(`Link con ID "${linkId}" no encontrado.`);
    });

    it('debería lanzar 404 si el ID no es un número válido', () => {
      const invalidId: any = 'abc';
      expect(() => controller.getLinkStats(invalidId)).toThrow(NotFoundException);
      expect(() => controller.getLinkStats(invalidId)).toThrow('El ID del link debe ser un número válido.');
    });
  });
});
