// ADMIN ONLY. Records reconciliation, never initiates a gateway refund.
import { query,transaction } from "./db"
import { isSafePublicOrderId } from "../validation/identifiers"

export const selfBuildReviewReasons=["PAID_ORDER_CANCELLED","LATE_PAYMENT_AFTER_CANCELLATION"] as const
export type SelfBuildReviewReason=typeof selfBuildReviewReasons[number]
export type SelfBuildPaymentReview={
  publicOrderId:string;reason:SelfBuildReviewReason;
  reviewStatus:"open"|"documented";amountPaise:number;
  paymentStatus:string;orderStatus:string;createdAt:string;
  externalReference:string|null;documentedAt:string|null
}
export async function listSelfBuildPaymentReviews(){
  const r=await query<{
    public_id:string;reason:SelfBuildReviewReason;review_status:"open"|"documented";
    amount_paise:number;payment_status:string;status:string;
    created_at:Date;external_ref:string|null;documented_at:Date|null
  }>(`SELECT o.public_id,r.reason,r.review_status,o.amount_paise,
      o.payment_status,o.status,r.created_at,r.external_ref,r.documented_at
    FROM self_build_payment_reviews r JOIN orders o ON o.id=r.order_id
    ORDER BY (r.review_status='open') DESC,r.created_at DESC LIMIT 100`)
  return r.rows.map(x=>({
    publicOrderId:x.public_id,reason:x.reason,reviewStatus:x.review_status,
    amountPaise:x.amount_paise,paymentStatus:x.payment_status,orderStatus:x.status,
    createdAt:x.created_at.toISOString(),externalReference:x.external_ref,
    documentedAt:x.documented_at?.toISOString()??null
  }))
}
export async function documentSelfBuildRefundReference(input:{
  publicOrderId:string;reason:SelfBuildReviewReason;externalReference:string;note:string
}){
  if(!isSafePublicOrderId(input.publicOrderId)||!selfBuildReviewReasons.includes(input.reason)||
     typeof input.externalReference!=="string"||!(/^[A-Za-z0-9][A-Za-z0-9_\-\/]{3,139}$/.test(input.externalReference))||
     typeof input.note!=="string"||input.note.trim().length<8||input.note.trim().length>500||
     /[\u0000-\u001f\u007f]/.test(input.note))
    throw Error("INVALID_REFUND_DOCUMENTATION")
  return transaction(async client=>{
    const r=await client.query<{review_status:string}>(`
      UPDATE self_build_payment_reviews SET
       review_status='documented',external_ref=$3,admin_note=$4,
       documented_at=COALESCE(documented_at,now())
      WHERE order_id=(SELECT id FROM orders WHERE public_id=$1)
        AND reason=$2 AND review_status='open'
      RETURNING review_status`,
      [input.publicOrderId,input.reason,input.externalReference,input.note.trim()])
    if(r.rows.length)return {documented:true}
    const old=await client.query<{review_status:string;external_ref:string|null}>(`
      SELECT r.review_status,r.external_ref FROM self_build_payment_reviews r
      JOIN orders o ON o.id=r.order_id
      WHERE o.public_id=$1 AND r.reason=$2`,[input.publicOrderId,input.reason])
    if(old.rows[0]?.review_status==="documented"&&old.rows[0].external_ref===input.externalReference)
      return {documented:true}
    throw Error("PAYMENT_REVIEW_NOT_OPEN")
  })
}
