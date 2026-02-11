import { consoleLogger, nullLogger, createLogger, Logger } from '../../src/utils/logger';

describe('Logger', () => {
  describe('consoleLogger', () => {
    it('should have all log methods', () => {
      expect(typeof consoleLogger.debug).toBe('function');
      expect(typeof consoleLogger.info).toBe('function');
      expect(typeof consoleLogger.warn).toBe('function');
      expect(typeof consoleLogger.error).toBe('function');
    });

    it('should call console.warn for warn level', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleLogger.warn('test warning');
      expect(spy).toHaveBeenCalledWith('test warning');
      spy.mockRestore();
    });

    it('should call console.error for error level', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      consoleLogger.error('test error');
      expect(spy).toHaveBeenCalledWith('test error');
      spy.mockRestore();
    });

    it('should not call console.debug (silent by default)', () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      consoleLogger.debug('should be silent');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('nullLogger', () => {
    it('should not call any console methods', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      nullLogger.debug('test');
      nullLogger.info('test');
      nullLogger.warn('test');
      nullLogger.error('test');

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('createLogger', () => {
    it('should suppress warn when minLevel is error', () => {
      const logger = createLogger('error');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      logger.warn('should be suppressed');
      expect(warnSpy).not.toHaveBeenCalled();

      logger.error('should appear');
      expect(errorSpy).toHaveBeenCalledWith('should appear');

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should output all levels when minLevel is debug', () => {
      const logger = createLogger('debug');
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      logger.debug('d');
      logger.info('i');
      logger.warn('w');

      expect(debugSpy).toHaveBeenCalledWith('d');
      expect(logSpy).toHaveBeenCalledWith('i');
      expect(warnSpy).toHaveBeenCalledWith('w');

      debugSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should suppress everything when minLevel is silent', () => {
      const logger = createLogger('silent');
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('should be suppressed');
      expect(errorSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should default to warn level', () => {
      const logger = createLogger();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      logger.info('suppressed');
      expect(logSpy).not.toHaveBeenCalled();

      logger.warn('shown');
      expect(warnSpy).toHaveBeenCalledWith('shown');

      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('Logger interface', () => {
    it('should be implementable as a custom logger', () => {
      const messages: string[] = [];
      const custom: Logger = {
        debug: (msg) => messages.push(`DEBUG: ${msg}`),
        info: (msg) => messages.push(`INFO: ${msg}`),
        warn: (msg) => messages.push(`WARN: ${msg}`),
        error: (msg) => messages.push(`ERROR: ${msg}`),
      };

      custom.debug('d');
      custom.info('i');
      custom.warn('w');
      custom.error('e');

      expect(messages).toEqual([
        'DEBUG: d',
        'INFO: i',
        'WARN: w',
        'ERROR: e'
      ]);
    });
  });
});
