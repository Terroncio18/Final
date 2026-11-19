// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
const boot = vi.hoisted(() => ({
  bootstrapApplication: vi.fn(),
  app: class {},
  config: { providers: [] },
}));
vi.mock('@angular/platform-browser', () => ({ bootstrapApplication: boot.bootstrapApplication }));
vi.mock('../app', () => ({ App: boot.app }));
vi.mock('../app.config', () => ({ appConfig: boot.config }));

it('bootstraps the configured application and reports startup failures', async () => {
  const error = new Error('startup failed');
  boot.bootstrapApplication.mockRejectedValue(error);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await import('../../main');
    expect(boot.bootstrapApplication).toHaveBeenCalledWith(boot.app, boot.config);
    expect(log).toHaveBeenCalledWith(error);
  } finally {
    log.mockRestore();
  }
});
