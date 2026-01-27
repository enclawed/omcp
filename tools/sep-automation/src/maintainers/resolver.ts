/**
 * Core maintainer team lookup
 */

import type { Logger } from "pino";
import type { Config } from "../config.js";
import type { GitHubClient } from "../github/client.js";

/**
 * The root team whose members (including all subteam members) can sponsor SEPs.
 * The GitHub API's getMembershipForUserInOrg checks nested team membership automatically.
 */
const SPONSOR_ROOT_TEAM = "steering-committee";

export class MaintainerResolver {
  private readonly config: Config;
  private readonly github: GitHubClient;
  private readonly logger: Logger | undefined;
  // Cache of username -> canSponsor result
  private readonly sponsorCache: Map<string, boolean> = new Map();

  constructor(config: Config, github: GitHubClient, logger?: Logger) {
    this.config = config;
    this.github = github;
    this.logger = logger;
  }

  /**
   * Check if a user can sponsor SEPs.
   * Uses getMembershipForUserInOrg which automatically checks nested team membership,
   * avoiding the need for admin permissions to enumerate child teams.
   */
  async canSponsor(username: string): Promise<boolean> {
    // Check cache first
    const cached = this.sponsorCache.get(username);
    if (cached !== undefined) {
      return cached;
    }

    const isMember = await this.github.isTeamMember(
      this.config.targetOwner,
      SPONSOR_ROOT_TEAM,
      username,
    );

    // Cache the result
    this.sponsorCache.set(username, isMember);

    this.logger?.debug(
      { username, isMember, team: SPONSOR_ROOT_TEAM },
      "Checked sponsor eligibility",
    );

    return isMember;
  }

  /**
   * Get the sponsor (allowed assignee) for a SEP
   */
  async getSponsor(assignees: string[]): Promise<string | null> {
    for (const assignee of assignees) {
      if (await this.canSponsor(assignee)) {
        return assignee;
      }
    }
    return null;
  }

  /**
   * Clear the cached sponsor results (useful for testing)
   */
  clearCache(): void {
    this.sponsorCache.clear();
  }
}
