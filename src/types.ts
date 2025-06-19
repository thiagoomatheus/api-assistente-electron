import { RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

export type FastifyTypedInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyBaseLogger,
    ZodTypeProvider
>

export type AsaasClient = {
  object: string,
  id: string,
  dateCreated: string,
  name: string,
  email: string,
  phone: string,
  mobilePhone: string,
  address: string,
  addressNumber: string,
  complement: string,
  province: string,
  city: string,
  cityName: string,
  state: string,
  country: string,
  postalCode: string,
  cpfCnpj: string,
  personType: string,
  deleted: boolean,
  additionalEmails: string,
  externalReference: string,
  notificationDisabled: boolean,
  observations: string,
  foreignCustomer: boolean
}