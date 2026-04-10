import { z } from "zod";
import { BusinessType } from "@/generated/prisma/client";

export const businessInfoSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  businessType: z.nativeEnum(BusinessType),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  description: z.string().max(500, "Description too long").optional(),
});

export const addressSchema = z.object({
  street: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

export const bankAccountSchema = z.object({
  bankName: z.string().min(2, "Bank name is required"),
  accountName: z.string().min(2, "Account name is required"),
  accountNumber: z.string().min(5, "Account number is required"),
  routingNumber: z.string().optional(),
  iban: z.string().optional(),
  swiftCode: z.string().optional(),
  currency: z.string().default("USD"),
});

export const contactSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  type: z.string(),
});

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
