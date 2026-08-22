<script lang="ts">
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import { isDesktop } from '@/rpcClient'
  import OrbitMark from '../../OrbitMark.svelte'
  import SettingSection from '../SettingSection.svelte'
  import SettingRow from '../SettingRow.svelte'

  const SOURCE_URL = 'https://github.com/fkrndev/orbit'

  /**
   * Where the app is, where its own files are, and where its source is.
   *
   * The settings path is here because it is the answer to "how do I reset
   * everything" and to "what did the app write to my disk" — both of which are
   * otherwise unanswerable from inside the app. It names orbit-lite's own
   * directory, which is deliberately *not* the React build's — see
   * `src/bun/paths.ts`.
   *
   * The source link is here because it has to be. Orbit is AGPL-3.0, and this app
   * can be served over HTTP (`bun run dev:browser`) — so anyone reaching it over a
   * network is a user the licence requires us to offer the source to, and section
   * 13 wants that offer to be prominent rather than buried in a repository they
   * would have to already know about.
   */
  const MONO = 'max-w-[22rem] truncate font-mono text-[12px]'
</script>

<SettingSection
  title="About Orbit Lite"
  description="Notes are plain markdown files. Nothing here is stored in a database."
>
  {#snippet icon()}<OrbitMark size={16} />{/snippet}

  <SettingRow title="Version" control={version} />
  <SettingRow
    title="Build"
    description={isDesktop
      ? 'Running as the desktop app.'
      : 'Running in a browser against the local server — some native features are unavailable.'}
    control={build}
  />
  <SettingRow
    title="Settings file"
    description="Preferences, open tabs, and the folder list. Delete it to start clean."
    control={settingsPath}
  />
  <SettingRow
    title="Source code"
    description="Orbit is free software under the AGPL-3.0, and a modified version of Tolaria."
    control={source}
  />
</SettingSection>

{#snippet version()}
  <span class={MONO} style="color: var(--text-muted)">{__APP_VERSION__}</span>
{/snippet}

{#snippet build()}
  <span class={MONO} style="color: var(--text-muted)">{isDesktop ? 'desktop' : 'browser'}</span>
{/snippet}

{#snippet settingsPath()}
  <span
    class={MONO}
    style="color: var(--text-muted)"
    title="~/Library/Application Support/local.orbitlite.app"
  >
    ~/Library/Application Support/local.orbitlite.app
  </span>
{/snippet}

{#snippet source()}
  <a
    href={SOURCE_URL}
    target="_blank"
    rel="noreferrer noopener"
    class="flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
    style="color: var(--text-muted)"
  >
    github.com/fkrndev/orbit
    <ExternalLink size={12} strokeWidth={2} class="shrink-0" />
  </a>
{/snippet}
