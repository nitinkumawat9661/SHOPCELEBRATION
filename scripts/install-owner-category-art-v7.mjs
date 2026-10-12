#!/usr/bin/env node
import sharp from "sharp"
import pg from "pg"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
const prefix="catalog/editorial/category-v7/"
const entries=[
 ["Premium Anti-Tarnish Necklaces","premium-necklaces","c5e3dbef-6d9f-4c2f-b06a-a9a1f8276778"],
 ["Necklace + Earrings Sets","necklace-earring-sets","fff33bb8-ba9e-4ca4-b4b6-19e2ff4574f8"],
 ["Trending Necklaces","trending-necklaces","eb14aa60-8a80-4a87-9551-ac512b4e2b98"],
 ["Gold-Plated Bangles & Bracelets","bangles-bracelets","1d42179d-acf2-4e7b-a465-7722ce5f4191"],
 ["Adjustable Rings","adjustable-rings","a4930dd2-6f88-4e2a-9b7c-65735f83d423"],
 ["Earrings","earrings","05de6ae6-9769-4f63-b5c7-5cf8bb3297f7"],
 ["__all__","all-jewellery","47bb1f95-0b05-4e61-8499-e545e6eb4c6d"],
 ["__hamper__","custom-hampers","6b6a8767-e3ef-4984-a4de-beb39552930b"]
]
