import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SafariCompanion } from './SafariCompanion';
import { contacts, scenarios } from './test/fixtures';

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const status = () => screen.getByTestId('status-companion');

function mount(initialNumber?: string) {
  const onOfficialContact = vi.fn();
  const view = render(
    <SafariCompanion
      initialNumber={initialNumber}
      exampleContacts={[...contacts]}
      onOfficialContact={onOfficialContact}
      renderFish={(state, tick, activate, label) => (
        <button aria-label={label} data-state={state} data-tick={tick} onClick={activate}>Hook</button>
      )}
    />,
  );
  return { ...view, onOfficialContact };
}

function start(verdict: string) {
  fireEvent.click(within(screen.getByTestId(`card-search-${verdict}`)).getByRole('button'));
}

describe('number-bound evidence', () => {
  it.each(scenarios)('keeps $verdict attached to $number through its evidence sheet', ({ verdict, number, label }) => {
    mount();
    start(verdict);
    expect(status()).toHaveTextContent(`Hook is swimming to ${number}`);
    expect(screen.queryByTestId(`button-evidence-${verdict}`)).not.toBeInTheDocument();
    advance(719);
    expect(status()).toHaveTextContent('swimming');
    advance(1);
    expect(status()).toHaveTextContent(`Checking illustrative sources for ${number}`);
    advance(1499);
    expect(screen.queryByTestId(`button-evidence-${verdict}`)).not.toBeInTheDocument();
    advance(1);
    expect(status()).toHaveTextContent(`${label} for ${number}`);
    const card = within(screen.getByTestId(`card-search-${verdict}`));
    expect(card.getByRole('button', { name: /Replay local demo/ })).toHaveAttribute('data-state', verdict);
    click(`button-evidence-${verdict}`);
    expect(screen.getByRole('dialog', { name: label })).toBeVisible();
    const evidence = screen.getByTestId('text-evidence-target');
    expect(evidence).toHaveTextContent(number);
    expect(evidence).toHaveTextContent('Claimed company: Aster Air');
    for (const other of scenarios.filter(s => s.verdict !== verdict)) {
      expect(evidence).not.toHaveTextContent(other.number);
    }
  });

  it.each([
    ['official', 'suspicious', 'unverified'],
    ['unverified', 'official', 'suspicious'],
    ['suspicious', 'unverified', 'official'],
  ])('only completes the latest rapid target: %s → %s → %s', (first, second, last) => {
    mount();
    start(first);
    advance(500);
    start(second);
    advance(500);
    start(last);
    const expected = scenarios.find(s => s.verdict === last)!;
    // Cross both earlier result deadlines while the last request is still pending.
    advance(1720);
    expect(status()).toHaveTextContent(`Checking illustrative sources for ${expected.number}`);
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
    advance(500);
    expect(status()).toHaveTextContent(`${expected.label} for ${expected.number}`);
    expect(screen.getAllByTestId(/^button-evidence-/)).toHaveLength(1);
    click(`button-evidence-${last}`);
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(expected.number);
    advance(5000);
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(expected.number);
  });
});

describe('cancelling work', () => {
  it.each([300, 1000])('clears both pending phases on unmount at %ims', elapsed => {
    const view = mount();
    start('suspicious');
    advance(elapsed);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(view.onOfficialContact).not.toHaveBeenCalled();
  });

  it.each([300, 1000])('cancels Safari work when switching mode at %ims', elapsed => {
    mount();
    start('suspicious');
    advance(elapsed);
    click('button-mode-manual');
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(status()).toHaveTextContent('Manual demo. Enter a number');
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
  });

  it.each([300, 1000])('cancels manual work when input changes at %ims', elapsed => {
    mount('+1 (202) 555-0187');
    click('button-manual-check');
    advance(elapsed);
    fireEvent.change(screen.getByLabelText('Number or fictional company'), { target: { value: 'new entry' } });
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(status()).toHaveTextContent('Entry changed');
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
    click('button-manual-check');
    advance(2220);
    click('button-evidence-unverified');
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent('new entry');
    expect(screen.getByTestId('text-evidence-target')).not.toHaveTextContent('555-0187');
  });

  it('cancels manual work on return to Safari and does not resurrect it', () => {
    mount('The Cove Hotel');
    click('button-manual-check');
    advance(1000);
    click('button-mode-safari');
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(status()).toHaveTextContent('Back in the Safari preview');
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
  });

  it.each(['button-reset-demo', 'button-scenario-unverified'])('cancels pending work via %s', id => {
    mount();
    start('official');
    advance(1000);
    click(id);
    const message = status().textContent;
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(status().textContent).toBe(message);
    expect(screen.queryAllByTestId(/^button-evidence-/)).toHaveLength(0);
  });
});

describe('manual matching without inferred ownership', () => {
  it.each(scenarios)('recognizes the $verdict sample number manually', ({ verdict, number, label }) => {
    mount(number);
    click('button-manual-check');
    advance(2220);
    expect(status()).toHaveTextContent(`${label} for ${number}`);
    click(`button-evidence-${verdict}`);
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(number);
  });

  it.each(contacts)('matches $name rather than defaulting to the airline', ({ name, number }) => {
    mount(`  ${name.toLowerCase()}  `);
    click('button-manual-check');
    advance(2220);
    click('button-evidence-official');
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(`Claimed company: ${name}`);
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent(number);
    expect(screen.getByText(`Exact match with ${name}’s fictional directory entry: ${number}. This is a sample match, not an endorsement.`)).toBeVisible();
  });

  it.each(['2025550168', '1-202-555-0168', '+1 (202) 555-0168'])('normalizes hotel number %s', value => {
    mount(value);
    click('button-manual-check');
    advance(2220);
    click('button-evidence-official');
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent('The Cove Hotel');
    expect(screen.getByTestId('text-evidence-target')).toHaveTextContent('+1 (202) 555-0168');
  });

  it.each(['+44 20 7946 0999', 'Unknown Hotel'])('leaves %s unverified and company-neutral', value => {
    const { onOfficialContact } = mount(value);
    click('button-manual-check');
    advance(2220);
    click('button-evidence-unverified');
    const evidence = screen.getByTestId('text-evidence-target');
    expect(evidence).toHaveTextContent(value);
    expect(evidence).toHaveTextContent('Not supplied · no company inferred');
    expect(evidence).not.toHaveTextContent('Aster Air');
    expect(screen.getByText(/No company ownership is inferred/)).toBeVisible();
    expect(screen.getByTestId('button-evidence-official-contact')).toHaveTextContent('Explore Aster Air’s demo official contact');
    click('button-evidence-official-contact');
    expect(onOfficialContact).toHaveBeenCalledExactlyOnceWith('+1 (202) 555-0142');
  });
});
