import prisma from "../lib/prisma";
import { Contact, LinkPrecedence } from "../generated/prisma/client";

interface IdentifyResult {
  primaryContactId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export async function identifyContact(
  email: string | undefined,
  phoneNumber: string | undefined
): Promise<IdentifyResult> {
  // Step 1: Fetch all contacts matching email OR phoneNumber
  const matchConditions = [];
  if (email) matchConditions.push({ email });
  if (phoneNumber) matchConditions.push({ phoneNumber });

  const matchedContacts = await prisma.contact.findMany({
    where: {
      OR: matchConditions,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  // Step 2: No match → create new primary
  if (matchedContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkPrecedence: LinkPrecedence.primary,
      },
    });

    return buildResponse(newContact, []);
  }

  // Resolve all unique primary IDs from the matched contacts
  const primaryIds = new Set<number>();
  for (const c of matchedContacts) {
    if (c.linkPrecedence === LinkPrecedence.primary) {
      primaryIds.add(c.id);
    } else if (c.linkedId !== null) {
      primaryIds.add(c.linkedId);
    }
  }

  // Step 4: Merge case — multiple primary groups found
  if (primaryIds.size > 1) {
    return await mergeGroups(Array.from(primaryIds), email, phoneNumber);
  }

  // Step 3: Single identity group
  const primaryId = primaryIds.values().next().value!;
  return await handleSingleGroup(primaryId, email, phoneNumber);
}

async function handleSingleGroup(
  primaryId: number,
  email: string | undefined,
  phoneNumber: string | undefined
): Promise<IdentifyResult> {
  // Fetch the primary and all its secondaries
  const allContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryId }, { linkedId: primaryId }],
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  const primary = allContacts.find((c) => c.id === primaryId)!;
  const secondaries = allContacts.filter((c) => c.id !== primaryId);

  // Check if this request introduces new information
  const hasNewInfo = checkForNewInfo(allContacts, email, phoneNumber);

  if (hasNewInfo) {
    const newSecondary = await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkedId: primaryId,
        linkPrecedence: LinkPrecedence.secondary,
      },
    });
    secondaries.push(newSecondary);
  }

  return buildResponse(primary, secondaries);
}


async function mergeGroups(
  primaryIds: number[],
  email: string | undefined,
  phoneNumber: string | undefined
): Promise<IdentifyResult> {
  // Fetch all primary contacts to determine the oldest
  const primaries = await prisma.contact.findMany({
    where: { id: { in: primaryIds }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const truePrimary = primaries[0];
  const primaryIdsToConvert = primaries.slice(1).map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    // Convert newer primaries → secondary, link to true primary
    await tx.contact.updateMany({
      where: { id: { in: primaryIdsToConvert } },
      data: {
        linkedId: truePrimary.id,
        linkPrecedence: LinkPrecedence.secondary,
        updatedAt: new Date(),
      },
    });

    // Re-link all secondaries that pointed to the old primaries
    await tx.contact.updateMany({
      where: { linkedId: { in: primaryIdsToConvert } },
      data: {
        linkedId: truePrimary.id,
        updatedAt: new Date(),
      },
    });
  });

  return await handleSingleGroup(truePrimary.id, email, phoneNumber);
}


function checkForNewInfo(
  contacts: Contact[],
  email: string | undefined,
  phoneNumber: string | undefined
): boolean {
  if (!email || !phoneNumber) return false;

  const existingEmails = new Set(contacts.map((c) => c.email).filter(Boolean));
  const existingPhones = new Set(contacts.map((c) => c.phoneNumber).filter(Boolean));

  const emailIsNew = !existingEmails.has(email);
  const phoneIsNew = !existingPhones.has(phoneNumber);

  return emailIsNew || phoneIsNew;
}

function buildResponse(primary: Contact, secondaries: Contact[]): IdentifyResult {
  const emails: string[] = [];
  const phoneNumbers: string[] = [];
  const secondaryContactIds: number[] = [];

  // Primary's info first
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  // Then secondaries (in order)
  for (const s of secondaries) {
    secondaryContactIds.push(s.id);
    if (s.email && !emails.includes(s.email)) emails.push(s.email);
    if (s.phoneNumber && !phoneNumbers.includes(s.phoneNumber)) phoneNumbers.push(s.phoneNumber);
  }

  return {
    primaryContactId: primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds,
  };
}
