import { Request, Response } from "express";

export const identify = async (req: Request, res: Response): Promise<void> => {
  const { email, phoneNumber } = req.body;

  // Validate: at least one must be provided
  if (!email && !phoneNumber) {
    res.status(400).json({ error: "At least one of email or phoneNumber must be provided." });
    return;
  }

  // Validate types: must be strings if provided
  if (email !== undefined && typeof email !== "string") {
    res.status(400).json({ error: "email must be a string." });
    return;
  }

  if (phoneNumber !== undefined && typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber must be a string." });
    return;
  }

  // TODO: Replace with actual identify logic in Phase 4
  res.status(200).json({
    contact: {
      primaryContactId: 1,
      emails: ["dummy@example.com"],
      phoneNumbers: ["1234567890"],
      secondaryContactIds: [],
    },
  });
};
