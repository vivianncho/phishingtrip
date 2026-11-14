import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Stillwater } from './Stillwater';
import { contacts, scenarios } from './test/fixtures';

const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const finish = () => act(() => vi.advanceTimersByTime(2220));

describe('directory contact routing through the real parent and fish', () => {
  it.each(contacts)('round-trips $name between directory, manual result, and evidence', ({ id, name, number }) => {
    render(<Stillwater />);
    click('button-nav-directory');
    click(`button-company-${id}`);
    expect(screen.getByRole('heading', { level: 1, name })).toBeVisible();
    expect(screen.getByText(number)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare a manual demo check' }));
    expect(screen.getByLabelText('Number or fictional company')).toHaveValue(number);
    expect(screen.queryByTestId('button-evidence-official')).not.toBeInTheDocument();
    click('button-manual-check');
    finish();
    expect(screen.getByRole('img', { name: 'Hook the fish, official' })).toBeInTheDocument();
    click('button-evidence-official');
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(name);
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(number);
    click('button-evidence-official-contact');
    expect(screen.getByTestId('button-nav-directory')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name })).toBeVisible();
    expect(screen.getByText(number)).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"], a[href^="http"]')).toBeNull();
    expect(screen.getByText(/Calling is intentionally unavailable/)).toBeVisible();
    click('button-return-browsing');
    expect(screen.getByTestId('card-search-official')).toBeVisible();
    expect(screen.queryByTestId('input-manual-number')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
  });

  it.each(scenarios)('routes the $verdict Safari result to the claimed company’s listed contact', ({ verdict, number }) => {
    render(<Stillwater />);
    fireEvent.click(screen.getByRole('button', { name: `Start local demo check for ${number}, claimed Aster Air. ${scenarios.find(s => s.verdict === verdict)!.label} scenario.` }));
    finish();
    expect(screen.getByRole('img', { name: `Hook the fish, ${verdict}` })).toBeInTheDocument();
    click(`button-evidence-${verdict}`);
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(number);
    click('button-evidence-official-contact');
    expect(screen.getByRole('heading', { level: 1, name: 'Aster Air' })).toBeVisible();
    expect(screen.getByText('+1 (202) 555-0142')).toBeVisible();
    if (verdict !== 'official') expect(screen.queryByText(number)).not.toBeInTheDocument();
  });

  it('cancels a running companion check when navigation unmounts it', () => {
    render(<Stillwater />);
    click('button-pip-0187');
    act(() => vi.advanceTimersByTime(1000));
    click('button-nav-directory');
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(5000));
    click('button-nav-check');
    expect(screen.getByTestId('status-companion')).toHaveTextContent('Hook is waiting');
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
  });
});
