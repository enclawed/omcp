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
  private maintainerSet: Set<string> | null = null;
  private loadAttempted = false;

  constructor(config: Config, github: GitHubClient, logger?: Logger) {
    this.config = config;
    this.github = github;
    this.logger = logger;
  }

  /**
   * Load the maintainer list from the API, falling back to static list on error.
   */
  private async ensureMaintainersLoaded(): Promise<Set<string>> {
    if (this.maintainerSet) {
      return this.maintainerSet;
    }

    if (this.loadAttempted) {
      // Already tried and failed, use fallback
      return FALLBACK_MAINTAINERS;
    }

    this.loadAttempted = true;

    try {
      const members = await this.github.getTeamMembers(
        this.config.targetOwner,
        this.config.maintainersTeam
      );
      this.maintainerSet = new Set(members);
      this.logger?.info(
        { count: members.length, members },
        'Loaded core maintainers from API'
      );
      return this.maintainerSet;
    } catch (error) {
      this.logger?.warn(
        { error: String(error) },
        'Failed to load team members from API, using fallback list'
      );
      this.maintainerSet = FALLBACK_MAINTAINERS;
      return this.maintainerSet;
    }
  }

  /**
   * Check if a user is a core maintainer
   */
  async isCoreMaintainer(username: string): Promise<boolean> {
    const maintainers = await this.ensureMaintainersLoaded();
    return maintainers.has(username);
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
   * Clear the cached maintainer list (useful for testing)
   */
  clearCache(): void {
    this.maintainerSet = null;
    this.loadAttempted = false;
  }
}
