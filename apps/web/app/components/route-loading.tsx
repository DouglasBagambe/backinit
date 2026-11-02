import { BrandMark, EventSkeleton } from "./brand";
export function RouteLoading() {
  return (
    <div className="main route-loading" aria-busy="true">
      <div className="route-loading-brand">
        <BrandMark />
        backinit.
      </div>
      <EventSkeleton label="Loading your matchday" />
    </div>
  );
}
