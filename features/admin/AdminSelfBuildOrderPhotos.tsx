"use client"

import { useState } from "react"

type Photo = {
  id: string
  createdAt: string
  deleted: boolean
  deletedAt: string | null
  scheduledDeleteAfter: string | null
}

export function AdminSelfBuildOrderPhotos({ publicId }: { publicId: string }) {
  const [open,setOpen] = useState(false)
  const [loaded,setLoaded] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState(false)
  const [photos,setPhotos] = useState<Photo[]>([])
  const base=`/api/admin/orders/${encodeURIComponent(publicId)}/photos`

  async function load() {
    if(busy)return
    setBusy(true)
    setError(false)
    try{
      const response=await fetch(base,{cache:"no-store",credentials:"same-origin"})
      if(!response.ok)throw Error("PHOTOS_UNAVAILABLE")
      const payload=await response.json() as {ok?:boolean;photos?:Photo[]}
      if(!payload.ok||!Array.isArray(payload.photos))throw Error("PHOTOS_UNAVAILABLE")
      setPhotos(payload.photos)
      setLoaded(true)
    }catch{setError(true)}
    finally{setBusy(false)}
  }
  return <details className="sbAdminPrivatePhotos" open={open}
    onToggle={e=>{
      const next=e.currentTarget.open
      setOpen(next)
      if(next&&!loaded&&!busy)void load()
    }}>
    <summary>Personalised photos <small>Private · deleted 48 hours after delivery</small></summary>
    {busy&&<p role="status">Loading private photos…</p>}
    {error&&<p role="alert">Photos unavailable. <button type="button" onClick={()=>void load()}>Retry</button></p>}
    {loaded&&!busy&&!photos.length&&<p>No personalised photos are attached to this order.</p>}
    {loaded&&!!photos.length&&<ul className="sbAdminPrivatePhotoGrid">
      {photos.map((photo,index)=>{
        const unavailable=photo.deleted || Boolean(photo.scheduledDeleteAfter&&
          Date.parse(photo.scheduledDeleteAfter)<=Date.now())
        return <li key={photo.id}>
          {unavailable?<span className="sbAdminPrivateDeleted">Deleted or expired</span>:
          <a href={`${base}/${encodeURIComponent(photo.id)}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/${encodeURIComponent(photo.id)}`}
              alt={`Private personalised photo ${index+1}`} loading="lazy" />
          </a>}
          <small>Photo {index+1}</small>
        </li>
      })}
    </ul>}
    {loaded&&<button className="secondary" type="button" onClick={()=>void load()} disabled={busy}>Refresh photos</button>}
  </details>
}
