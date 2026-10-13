// Read ONLY live, public hamper tier names/counts and occasions for Self-Build.
// Unlike the retail getCatalogConfig() helper this does not consult stock,
// availability, category capacity, inventory or retail product quantities.
import { query } from "./db"
import { normalizeCatalogConfig } from "./catalog"

export async function getSelfBuildPublishedCatalog(){
  const result=await query<{payload:unknown}>(
    "SELECT payload FROM catalog_config WHERE id='primary'")
  if(!result.rows[0])throw Error("SELF_BUILD_CATALOG_NOT_PUBLISHED")
  const catalog=normalizeCatalogConfig(result.rows[0].payload)
  return {
    tiers:catalog.tiers.filter(t=>t.active!==false),
    occasions:catalog.occasions
  }
}
