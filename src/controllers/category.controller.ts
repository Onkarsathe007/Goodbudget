import express from "express";
import prisma from "../config/db.config.js";
import { Router } from "express";
import type { Request, Response } from "express";

export const CategoryController = {
  async getCategories(req: Request, res: Response) {
    try {
      const response = await prisma.categories.findMany();
      if (!response) {
        res.status(404).json({ message: "record not found" });
      }
      res.json(response);
    } catch (error) {
      res.status(500).json("Internal Server error");
    }
  },
  async addCategories(req: Request, res: Response) {
    //POST Categories
  },
};
