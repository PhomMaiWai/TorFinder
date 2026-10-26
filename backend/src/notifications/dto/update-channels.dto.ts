import { IsBoolean, IsOptional, Matches, ValidateIf } from "class-validator";

import { LINE_ID, SLACK_WEBHOOK } from "../notification-delivery";

/** An empty string clears a channel; omitting a field leaves it as it was. */
export class UpdateChannelsDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== "")
  @Matches(SLACK_WEBHOOK, { message: "Slack Webhook URL ต้องขึ้นต้นด้วย https://hooks.slack.com/services/" })
  slackWebhookUrl?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== "")
  @Matches(LINE_ID, { message: "LINE ID ไม่ถูกต้อง (ขึ้นต้นด้วย U, C หรือ R ตามด้วยอักษร 32 ตัว)" })
  lineUserId?: string;
}
