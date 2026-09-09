export type TorFormValues = {
  title: string;
  agency: string;
  budget: string;
  deadline: string;
  daysLeft: number;
  tags: string[];
  stage: string;
  summary: string;
  budgetStatus: string;
};

export function parseTorFormData(formData: FormData): TorFormValues {
  const daysLeft = Number(formData.get("daysLeft") ?? 0);

  return {
    title: String(formData.get("title") ?? "").trim(),
    agency: String(formData.get("agency") ?? "").trim(),
    budget: String(formData.get("budget") ?? "").trim(),
    deadline: String(formData.get("deadline") ?? "").trim(),
    daysLeft: Number.isFinite(daysLeft) ? daysLeft : 0,
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    stage: String(formData.get("stage") ?? ""),
    summary: String(formData.get("summary") ?? "").trim(),
    budgetStatus: String(formData.get("budgetStatus") ?? ""),
  };
}

export function assertTorFormValid(values: TorFormValues) {
  if (!values.title || !values.agency || !values.budget || !values.deadline || !values.summary) {
    throw new Error("กรอกข้อมูลให้ครบก่อนบันทึก");
  }
}
