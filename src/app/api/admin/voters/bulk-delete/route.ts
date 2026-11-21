import { NextRequest } from "next/server";
import { DELETE as bulkDeleteHandler } from "../route";

export async function POST(request: NextRequest) {
  return bulkDeleteHandler(request);
}
