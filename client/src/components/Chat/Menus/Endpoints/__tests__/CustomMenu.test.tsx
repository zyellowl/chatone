import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomMenu, CustomMenuItem } from '../CustomMenu';

jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/utils', () => ({ cn: (...classes: string[]) => classes.filter(Boolean).join(' ') }));
jest.mock('@librechat/client', () => ({
  useMediaQuery: (query: string) => globalThis.matchMedia(query).matches,
}));

function setInputMode(mode: 'mobile' | 'tablet' | 'desktop') {
  jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches:
      (query === '(max-width: 767px)' && mode === 'mobile') ||
      (query === '(pointer: coarse)' && mode !== 'desktop') ||
      (query === '(hover: hover) and (pointer: fine)' && mode === 'desktop'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

function renderMenu(onSelect = jest.fn()) {
  render(
    <CustomMenu
      trigger={<button>{'Models'}</button>}
      combobox={<input />}
      comboboxLabel="Search models"
      values={{ model: 'one' }}
    >
      <CustomMenuItem name="model" value="one">
        {'Model one'}
      </CustomMenuItem>
      <CustomMenuItem name="model" value="two">
        {'Model two'}
      </CustomMenuItem>
      <CustomMenuItem onClick={onSelect}>
        {'Model spec'}
        <button type="button" onClick={(event) => event.stopPropagation()}>
          {'Pin'}
        </button>
      </CustomMenuItem>
    </CustomMenu>,
  );
}

describe('model menu focus', () => {
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(44);
  });
  it('opens on mobile without focusing search, supports typing, and restores focus on close', async () => {
    setInputMode('mobile');
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Models' }));
    const search = await screen.findByRole('combobox', { name: 'Search models' });
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    expect(search).not.toHaveFocus();
    await user.click(search);
    await user.type(search, 'two');
    expect(search).toHaveValue('two');
    await user.click(screen.getByRole('button', { name: 'com_ui_close_menu' }));
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Models' })).toHaveFocus();
  });

  it('keeps desktop search autofocus and closes after choosing a model', async () => {
    setInputMode('desktop');
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Models' }));
    const search = await screen.findByRole('combobox', { name: 'Search models' });
    await waitFor(() => expect(search).toHaveFocus());
    await user.click(screen.getByText('Model two'));
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it.each(['mobile', 'tablet'] as const)(
    'selects with one click on %s without ever focusing search',
    async (mode) => {
      setInputMode(mode);
      const user = userEvent.setup();
      const onSelect = jest.fn();
      renderMenu(onSelect);
      await user.click(screen.getByRole('button', { name: 'Models' }));
      const search = await screen.findByRole('combobox');
      await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
      const onSearchFocus = jest.fn();
      search.addEventListener('focus', onSearchFocus);
      const item = screen.getByRole('option', { name: 'Model spec Pin' });
      await user.hover(item);
      expect(search).not.toHaveFocus();
      await user.click(item);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSearchFocus).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Models' })).toHaveFocus();
    },
  );

  it('keeps search focus until selection finishes and does not select when pinning', async () => {
    setInputMode('mobile');
    const user = userEvent.setup();
    const onSelect = jest.fn();
    renderMenu(onSelect);
    await user.click(screen.getByRole('button', { name: 'Models' }));
    const search = await screen.findByRole('combobox');
    await user.click(screen.getByRole('button', { name: 'Pin' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(search).toBeVisible();
    await user.click(search);
    const item = screen.getByRole('option', { name: 'Model spec Pin' });
    await user.pointer({ keys: '[MouseLeft>]', target: item });
    expect(search).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    await user.pointer({ keys: '[/MouseLeft]', target: item });
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });
});
