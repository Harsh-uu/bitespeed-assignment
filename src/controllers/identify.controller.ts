import { Request, Response } from "express";
import { identifyContact } from "../services/identify.service";

export const identify = async (req: Request, res: Response): Promise<void> => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    res.status(400).json({ error: "At least one of email or phoneNumber must be provided." });
    return;
  }

  if (email !== undefined && typeof email !== "string") {
    res.status(400).json({ error: "email must be a string." });
    return;
  }

  if (phoneNumber !== undefined && typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber must be a string." });
    return;
  }

  try {
    const result = await identifyContact(email, phoneNumber);
    res.status(200).json({ contact: result });
  } catch (error) {
    console.error("Error in /identify:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
