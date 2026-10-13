import type { PoolClient } from "pg"
import { transaction } from "./db"
import { getCatalogConfig } from "./catalog"
import { SelfBuildAdminError } from "./self-build-admin"

// Private admin inventory; SKU-free. Quantities are confirmed category-level
// fulfilment capacity, NOT product stock, and are NOT yet reserved at checkout.
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/
const MAX_UNITS = 1_000_000
const MAX_BUDGET = 2_147_483_647

export type CategoryCapacity = {
  id: string
  label: string
  parentLabel: string | null
  active: boolean
  availableUnits: number
  reservedUnits: number
  verified: boolean
}
export type OptionCapacity = {
  id: string
  label: string
  groupLabel: string
  active: boolean
  availableUnits: number
  reservedUnits: number
  verified: boolean
}
export type TierAllowance = {
  id: string
  label: string
  sellingPricePaise: number
  allowancePaise: number
  enabled: boolean
}
export type SelfBuildCapacityState = {
  version: number
  settingsVersion: number
  categories: CategoryCapacity[]
  options: OptionCapacity[]
  tiers: TierAllowance[]
}

type ConfigRecord = { version: number }
type LockRecord = { version: number }
type CategoryRecord = {
  id: string; label: string; parent_label: string | null; active: boolean
  available_units: number | null; reserved_units: number | null; verified: boolean | null
}
type OptionRecord = {
  id: string; label: string; group_label: string; active: boolean
  available_units: number | null; reserved_units: number | null; verified: boolean | null
}
type TierRecord = {tier_id: string; allowance_paise: number; enabled: boolean}

function fail(code: string): never { throw new SelfBuildAdminError(code) }
function obj(value: unknown): Record<string,unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_CAPACITY_PAYLOAD")
  return value as Record<string,unknown>
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value<min || value>max) fail("INVALID_CAPACITY_NUMBER")
  return value
}
function rows(value: unknown, max: number): Record<string,unknown>[] {
  if (!Array.isArray(value) || value.length>max) fail("INVALID_CAPACITY_ROWS")
  return value.map(obj)
}
function exactIds<T extends {id: string}>(input: T[], expected: string[]) {
  if (input.length!==expected.length || new Set(input.map(v=>v.id)).size!==input.length ||
    input.some(v=>!expected.includes(v.id))) fail("CAPACITY_CHOICES_STALE")
}
function parseRow(input: Record<string,unknown>) {
  if (typeof input.id!=="string" || !ID.test(input.id)) fail("INVALID_CAPACITY_CHOICE")
  if (typeof input.verified!=="boolean") fail("INVALID_CAPACITY_VERIFIED")
  return {
    id:input.id, availableUnits:integer(input.availableUnits,0,MAX_UNITS),
    verified: input.verified
  }
}
function parseTier(input: Record<string,unknown>) {
  if (typeof input.id!=="string" || !ID.test(input.id)) fail("INVALID_CAPACITY_TIER")
  if (typeof input.enabled!=="boolean") fail("INVALID_TIER_ALLOWANCE_ENABLED")
  const allowancePaise=integer(input.allowancePaise,0,MAX_BUDGET)
  if (input.enabled && allowancePaise===0) fail("EMPTY_TIER_ALLOWANCE")
  return {id:input.id,allowancePaise,enabled:input.enabled}
}

async function readCapacity(client:PoolClient, tiers: {id:string;name:string;price:number;active?:boolean}[]):Promise<SelfBuildCapacityState> {
  const [config, control, cats, options, allowance] = await Promise.all([
    client.query<ConfigRecord>("SELECT version FROM self_build_configuration WHERE id='primary'"),
    client.query<LockRecord>("SELECT version FROM self_build_capacity_control WHERE id='primary'"),
    client.query<CategoryRecord>(`SELECT c.id,c.label,p.label AS parent_label,c.active,
       i.available_units,i.reserved_units,i.verified
       FROM self_build_categories c LEFT JOIN self_build_categories p ON p.id=c.parent_id
       LEFT JOIN self_build_category_capacity i ON i.category_id=c.id
       WHERE c.selection_kind IN ('category','photo') ORDER BY c.display_order,c.id`),
    client.query<OptionRecord>(`SELECT o.id,o.label,c.label AS group_label,
       (o.active AND c.active) AS active,i.available_units,i.reserved_units,i.verified
       FROM self_build_options o JOIN self_build_categories c ON c.id=o.category_id
       LEFT JOIN self_build_option_capacity i ON i.option_id=o.id
       WHERE c.selection_kind='variant' ORDER BY c.display_order,o.display_order,o.id`),
    client.query<TierRecord>("SELECT tier_id,allowance_paise,enabled FROM self_build_tier_allowances")
  ])
  if(!config.rows[0]||!control.rows[0])throw new Error("SELF_BUILD_CAPACITY_MIGRATION_NOT_APPLIED")
  const stored=new Map(allowance.rows.map(item=>[item.tier_id,item]))
  return {
    version:control.rows[0].version,
    settingsVersion:config.rows[0].version,
    categories:cats.rows.map(c=>({
      id:c.id,label:c.label,parentLabel:c.parent_label,active:c.active,
      availableUnits:c.available_units??0,reservedUnits:c.reserved_units??0,verified:c.verified??false
    })),
    options:options.rows.map(o=>({
      id:o.id,label:o.label,groupLabel:o.group_label,active:o.active,
      availableUnits:o.available_units??0,reservedUnits:o.reserved_units??0,verified:o.verified??false
    })),
    tiers:tiers.filter(t=>t.active!==false).map(t=>({
      id:t.id,label:t.name,sellingPricePaise:Math.round(t.price*100),
      allowancePaise:stored.get(t.id)?.allowance_paise??0,enabled:stored.get(t.id)?.enabled??false
    }))
  }
}

export async function getSelfBuildCapacityState():Promise<SelfBuildCapacityState> {
  const {catalog}=await getCatalogConfig()
  return transaction(async client=>{
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
    return readCapacity(client,catalog.tiers)
  })
}

export async function saveSelfBuildCapacityState(input:unknown):Promise<SelfBuildCapacityState> {
  const data=obj(input)
  const version=integer(data.version,1,MAX_BUDGET)
  const settingsVersion=integer(data.settingsVersion,1,MAX_BUDGET)
  const categoryRows=rows(data.categories,200).map(parseRow)
  const optionRows=rows(data.options,1200).map(parseRow)
  const tierRows=rows(data.tiers,50).map(parseTier)
  const {catalog}=await getCatalogConfig()
  return transaction(async client=>{
    // Lock settings against simultaneous category edits, and capacity version
    // against two admin sessions overwriting the same verified quantities.
    const config=await client.query<ConfigRecord>(
      "SELECT version FROM self_build_configuration WHERE id='primary' FOR SHARE")
    const control=await client.query<LockRecord>(
      "SELECT version FROM self_build_capacity_control WHERE id='primary' FOR UPDATE")
    if(!config.rows[0]||!control.rows[0])throw new Error("SELF_BUILD_CAPACITY_MIGRATION_NOT_APPLIED")
    if(config.rows[0].version!==settingsVersion || control.rows[0].version!==version)fail("STALE_SELF_BUILD_CAPACITY")
    const current=await readCapacity(client,catalog.tiers)
    exactIds(categoryRows,current.categories.map(c=>c.id))
    exactIds(optionRows,current.options.map(o=>o.id))
    exactIds(tierRows,current.tiers.map(t=>t.id))
    for(const row of categoryRows){
      if(row.availableUnits < (current.categories.find(c=>c.id===row.id)?.reservedUnits??0))
        fail("CAPACITY_BELOW_RESERVED")
      await client.query(`INSERT INTO self_build_category_capacity (category_id,available_units,verified)
         VALUES ($1,$2,$3) ON CONFLICT(category_id) DO UPDATE SET
         available_units=EXCLUDED.available_units,verified=EXCLUDED.verified,updated_at=now()`,
         [row.id,row.availableUnits,row.verified])
    }
    for(const row of optionRows){
      if(row.availableUnits < (current.options.find(o=>o.id===row.id)?.reservedUnits??0))
        fail("CAPACITY_BELOW_RESERVED")
      await client.query(`INSERT INTO self_build_option_capacity (option_id,available_units,verified)
         VALUES ($1,$2,$3) ON CONFLICT(option_id) DO UPDATE SET
         available_units=EXCLUDED.available_units,verified=EXCLUDED.verified,updated_at=now()`,
         [row.id,row.availableUnits,row.verified])
    }
    for(const tier of tierRows){
      await client.query(`INSERT INTO self_build_tier_allowances (tier_id,allowance_paise,enabled)
         VALUES ($1,$2,$3) ON CONFLICT(tier_id) DO UPDATE SET
         allowance_paise=EXCLUDED.allowance_paise,enabled=EXCLUDED.enabled,updated_at=now()`,
         [tier.id,tier.allowancePaise,tier.enabled])
    }
    await client.query(`UPDATE self_build_capacity_control
       SET version=version+1,updated_at=now() WHERE id='primary'`)
    return readCapacity(client,catalog.tiers)
  })
}
