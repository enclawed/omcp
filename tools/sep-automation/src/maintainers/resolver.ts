/**
 * Core maintainer team lookup
 */

import type { Logger } from 'pino';
import type { Config } from '../config.js';
import type { GitHubClient } from '../github/client.js';

/**
 * Fallback list of core maintainers.
 * Used when the GitHub Teams API is not accessible (e.g., GITHUB_TOKEN lacks read:org scope).
 * Keep this in sync with the actual core-maintainers team.
 */
const FALLBACK_MAINTAINERS = new Set([
  'jspahrsummers',
  'pcarleton',
  'CaitieM20',
  'pwwpche',
  'kurtisvg',
  'localden',
  'nickcoai',
  'dsp-ant',
  'bhosmer-ant',
]);

export class MaintainerResolver {
  private readonly config: Config;
  private readonly github: GitHubClient;
  private readonly logger: Logger | undefined;
  private readonly cache: Map<string, boolean> = new Map();
  private readonly useAppAuth: boolean;

  constructor(config: Config, github: GitHubClient, logger?: Logger) {
    this.config = config;
    this.github = github;
    this.logger = logger;
    // Only use API if we have App auth (which has read:org permission)
    // GITHUB_TOKEN doesn't have permission to read team membership
    this.useAppAuth = !!(config.appId && config.appPrivateKey);

    if (!this.useAppAuth) {
      this.logger?.info(
        'Using fallback maintainer list (no App auth configured)'
      );
    }
  }

  /**
   * Check if a user is a core maintainer
   */
  async isCoreMaintainer(username: string): Promise<boolean> {
    // Check cache first
    const cached = this.cache.get(username);
    if (cached !== undefined) {
      return cached;
    }

    // If not using App auth, use fallback list (GITHUB_TOKEN can't read team membership)
    if (!this.useAppAuth) {
      const isMember = FALLBACK_MAINTAINERS.has(username);
      this.cache.set(username, isMember);
      return isMember;
    }

    try {
      const isMember = await this.github.isTeamMember(
        this.config.targetOwner,
        this.config.maintainersTeam,
        username
      );
      this.cache.set(username, isMember);
      return isMember;
    } catch (error) {
      // API failed, fall back to static list
      this.logger?.warn(
        { error: String(error), username },
        'Teams API call failed, falling back to static maintainer list'
      );
      const isMember = FALLBACK_MAINTAINERS.has(username);
      this.cache.set(username, isMember);
      return isMember;
    }
  }

  /**
   * Get the sponsor (maintainer assignee) for a SEP
   */
  async getSponsor(assignees: string[]): Promise<string | null> {
    for (const assignee of assignees) {
      if (await this.isCoreMaintainer(assignee)) {
        return assignee;
      }
    }
    return null;
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
