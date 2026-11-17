import { IsBoolean, IsOptional, Matches, ValidateIf } from "class-validator";

import { SLACK_WEBHOOK } from "../notification-delivery";

/**
 * An empty string clears a channel; omitting a field leaves it as it was.
 * LINE has its own link/unlink routes — a pasted id is never accepted.
 */
export class UpdateChannelsDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== "")
  @Matches(SLACK_WEBHOOK, { message: "Slack Webhook URL ต้องขึ้นต้นด้วย https://hooks.slack.com/services/" })
  slackWebhookUrl?: string;
}
