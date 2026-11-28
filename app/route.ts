import { stations } from "../lib/stations";
import { handleWritingGet, handleWritingPost } from "../lib/writing-route";

export const dynamic = "force-dynamic";

const blogStation = stations[0];

export function GET(request: Request) {
  return handleWritingGet(request, blogStation);
}

export function POST(request: Request) {
  return handleWritingPost(request, blogStation);
}
