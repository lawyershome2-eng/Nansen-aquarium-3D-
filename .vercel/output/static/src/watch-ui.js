// Search bar for Watch Mode. Ocean is the shared tide. Wallet, token, and name
// each open their own stream and close the previous one.

const $ = (id) => document.getElementById(id);

function modeOf(form) {
  return form.querySelector('input[name="watch-mode"]:checked')?.value || 'ocean';
}

export function installWatchBar(bridge) {
  const form = $('watch');
  const input = $('watch-q');
  const chain = $('watch-chain');
  const filter = $('watch-filter');
  const statusEl = $('watch-status');
  const picks = $('watch-picks');
  if (!form || !input || !chain || !filter || !statusEl || !picks || !bridge?.listen) return;

  let resolved = null;

  function paint(status) {
    const state = status?.state || '';
    statusEl.dataset.state = state;
    if (state === 'connecting') {
      statusEl.textContent = modeOf(form) === 'ocean' ? 'Opening the ocean…' : 'Opening the watch…';
      return;
    }
    if (state === 'error') {
      statusEl.textContent = status.error || 'Watch stopped.';
      return;
    }
    if (state === 'reconnecting') {
      statusEl.textContent = 'Reconnecting…';
      return;
    }
    if (status?.mode === 'mock') {
      statusEl.textContent = 'Smart money ocean · sample tide';
      return;
    }
    const bits = [];
    bits.push(status?.mode === 'demo' ? 'Demo tide' : 'Live');
    const subject = status?.subject || resolved?.label;
    if (subject) bits.push(subject);
    if (resolved?.chain) bits.push(resolved.chain);
    if (status?.note) bits.push(status.note);
    if (state === 'degraded' && status?.error) bits.push(status.error);
    if (status?.creditsRemaining != null) bits.push(`${status.creditsRemaining} credits left`);
    statusEl.textContent = bits.join(' · ');
  }

  bridge.subscribe((msg) => {
    resolved = msg.type === 'resolved' ? msg.data : msg.resolved;
    paint(msg.status);
  });

  function syncChrome() {
    const mode = modeOf(form);
    const ocean = mode === 'ocean';
    input.disabled = ocean;
    chain.disabled = ocean;
    filter.hidden = mode !== 'token';
    input.placeholder = mode === 'wallet'
      ? 'Wallet address'
      : mode === 'token'
        ? 'Token contract'
        : mode === 'name'
          ? 'Name or symbol'
          : 'Smart money ocean';
    const all = chain.querySelector('option[value="all"]');
    if (all) all.hidden = mode === 'token';
    if (mode === 'token' && chain.value === 'all') chain.value = 'ethereum';
  }

  form.querySelectorAll('input[name="watch-mode"]').forEach((el) => {
    el.addEventListener('change', () => {
      picks.hidden = true;
      picks.replaceChildren();
      syncChrome();
      if (modeOf(form) === 'ocean') {
        resolved = null;
        bridge.listen('/api/stream');
      }
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = modeOf(form);
    if (mode === 'ocean') {
      resolved = null;
      bridge.listen('/api/stream');
      return;
    }
    const query = input.value.trim();
    if (!query) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = mode === 'name' ? 'Enter a name or symbol.' : 'Enter an address.';
      return;
    }
    if (mode === 'name') {
      void searchName(query);
      return;
    }
    openDirect(mode, query);
  });

  function openDirect(mode, query) {
    const params = new URLSearchParams({ mode, chain: chain.value, address: query });
    if (mode === 'token' && filter.value === 'trades') params.set('filter', 'trades');
    picks.hidden = true;
    resolved = null;
    bridge.listen(`/api/watch/stream?${params}`);
  }

  async function searchName(query) {
    statusEl.dataset.state = '';
    statusEl.textContent = 'Searching…';
    picks.hidden = true;
    picks.replaceChildren();
    let data;
    try {
      const res = await fetch(`/api/watch/suggest?q=${encodeURIComponent(query)}&chain=${encodeURIComponent(chain.value)}`);
      data = await res.json();
    } catch {
      statusEl.dataset.state = 'error';
      statusEl.textContent = 'Search didn’t answer. Try again.';
      return;
    }
    if (data.error) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = data.error;
      return;
    }
    if (data.address) {
      showAddressChoice(data.address);
      return;
    }
    const tokens = data.tokens || [];
    const entities = data.entities || [];
    if (!tokens.length && !entities.length) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = `Nothing matched “${query}”.`;
      return;
    }
    if (tokens.length === 1 && !entities.length) {
      watchToken(tokens[0]);
      return;
    }
    renderPicks(tokens, entities);
  }

  function showAddressChoice(address) {
    statusEl.textContent = 'That looks like an address. Watch it as a wallet or a token.';
    picks.hidden = false;
    const wallet = document.createElement('button');
    wallet.type = 'button';
    wallet.textContent = 'Watch as wallet';
    wallet.addEventListener('click', () => {
      form.querySelector('input[value="wallet"]').checked = true;
      syncChrome();
      input.value = address;
      openDirect('wallet', address);
    });
    const token = document.createElement('button');
    token.type = 'button';
    token.textContent = 'Watch as token';
    token.addEventListener('click', () => {
      if (chain.value === 'all') chain.value = 'ethereum';
      form.querySelector('input[value="token"]').checked = true;
      syncChrome();
      input.value = address;
      openDirect('token', address);
    });
    picks.append(wallet, token);
  }

  function renderPicks(tokens, entities) {
    picks.hidden = false;
    statusEl.textContent = 'Pick one.';
    for (const token of tokens) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${token.symbol} · ${token.name} · ${token.chain}`;
      button.addEventListener('click', () => watchToken(token));
      picks.append(button);
    }
    for (const entity of entities) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entity.watchable ? `${entity.name} · demo tide` : `${entity.name} · needs a wallet address`;
      button.addEventListener('click', () => {
        if (!entity.watchable) {
          form.querySelector('input[value="wallet"]').checked = true;
          syncChrome();
          input.value = '';
          input.placeholder = 'Hot wallet address';
          picks.hidden = true;
          statusEl.dataset.state = 'error';
          statusEl.textContent = `${entity.name} has no wallet on this feed. Paste a hot-wallet address.`;
          input.focus();
          return;
        }
        picks.hidden = true;
        resolved = null;
        const params = new URLSearchParams({ mode: 'entity', name: entity.name, chain: chain.value });
        bridge.listen(`/api/watch/stream?${params}`);
      });
      picks.append(button);
    }
  }

  function watchToken(token) {
    chain.value = token.chain || chain.value;
    form.querySelector('input[value="token"]').checked = true;
    syncChrome();
    input.value = token.address;
    const params = new URLSearchParams({
      mode: 'token',
      chain: token.chain,
      address: token.address,
      symbol: token.symbol,
    });
    if (filter.value === 'trades') params.set('filter', 'trades');
    picks.hidden = true;
    resolved = null;
    bridge.listen(`/api/watch/stream?${params}`);
  }

  syncChrome();
  form.hidden = false;
}
