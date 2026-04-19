"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import type { AddressResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  id?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  onSelect: (address: AddressResult) => void;
  disabled?: boolean;
}

// Places API (New) web component. The legacy
// google.maps.places.Autocomplete widget silently returns zero results
// on projects where only "Places API (New)" is enabled, and Google now
// recommends PlaceAutocompleteElement as the forward path. This wrapper:
//
//   1. Loads @googlemaps/js-api-loader → importLibrary("places").
//   2. Instantiates PlaceAutocompleteElement inside a container div.
//   3. Listens for `gmp-select`, calls place.fetchFields(...), and
//      hands the parsed AddressResult back to the parent form.
//   4. Surfaces any load / fetch / gmp-error failure as a visible banner
//      so misconfigured billing or missing APIs don't fail silently.
//
// If the API key is missing or the Places library fails to load, the
// component degrades to a plain text input so the form still works.
export function AddressAutocomplete({
  id = "address-autocomplete",
  label = "Address",
  defaultValue = "",
  placeholder = "Start typing an address…",
  onSelect,
  disabled,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const onSelectRef = React.useRef(onSelect);

  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    apiKey
      ? null
      : "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Places autocomplete.",
  );

  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  React.useEffect(() => {
    if (!apiKey) return;

    const container = containerRef.current;
    let cancelled = false;
    let element: HTMLElement | null = null;

    (async () => {
      try {
        const { Loader } = await import("@googlemaps/js-api-loader");
        const loader = new Loader({
          apiKey,
          libraries: ["places"],
          version: "weekly",
        });
        await loader.importLibrary("places");

        if (cancelled || !container) return;

        const places = (google.maps as unknown as {
          places: Record<string, unknown>;
        }).places;
        const PlaceEl = places.PlaceAutocompleteElement as
          | (new (options?: Record<string, unknown>) => HTMLElement)
          | undefined;

        if (!PlaceEl) {
          setError(
            "Google Maps loaded but did not expose PlaceAutocompleteElement. " +
              "Enable 'Places API (New)' on the key's Google Cloud project and redeploy.",
          );
          return;
        }

        element = new PlaceEl({
          includedRegionCodes: ["us"],
        });
        element.id = id;
        element.style.display = "block";
        element.style.width = "100%";

        container.innerHTML = "";
        container.appendChild(element);

        if (defaultValue) {
          try {
            (element as unknown as { value?: string }).value = defaultValue;
          } catch {
            /* some builds don't expose .value; safe to skip */
          }
        }

        element.addEventListener("gmp-select", async (rawEvent: Event) => {
          try {
            const prediction = (
              rawEvent as unknown as {
                placePrediction?: {
                  toPlace: () => {
                    fetchFields: (args: { fields: string[] }) => Promise<void>;
                    addressComponents?: NewAddressComponent[];
                    formattedAddress?: string;
                    location?: { lat: () => number; lng: () => number } | null;
                  };
                };
              }
            ).placePrediction;
            if (!prediction) return;
            const place = prediction.toPlace();
            await place.fetchFields({
              fields: ["addressComponents", "formattedAddress", "location"],
            });
            onSelectRef.current(parsePlace(place));
            setError(null);
          } catch (err) {
            console.error("[address-autocomplete] fetchFields failed", err);
            setError(
              err instanceof Error && err.message
                ? `Failed to fetch place details: ${err.message}`
                : "Failed to fetch place details. Confirm billing is enabled on the Google Cloud project.",
            );
          }
        });

        element.addEventListener("gmp-error", (rawEvent: Event) => {
          const payload = (rawEvent as unknown as { error?: { message?: string } })
            .error;
          console.error("[address-autocomplete] gmp-error", payload);
          setError(
            payload?.message
              ? `Google Places error: ${payload.message}`
              : "Google Places returned an error. Confirm billing is enabled and both 'Places API' and 'Places API (New)' are turned on.",
          );
        });

        setReady(true);
      } catch (err) {
        console.error("[address-autocomplete] failed to load Google Places", err);
        setError(
          err instanceof Error && err.message
            ? `Failed to load Google Places: ${err.message}`
            : "Failed to load Google Places. Confirm the API key is valid and billing is enabled.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
      element = null;
    };
  }, [apiKey, defaultValue, id]);

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}

      {apiKey ? (
        <div
          ref={containerRef}
          className={cn(
            "min-h-[40px]",
            // The web component renders its own input inside a shadow
            // DOM, so we only control the outer width and block layout.
          )}
          aria-disabled={disabled ? "true" : undefined}
        />
      ) : (
        <input
          id={id}
          className="flex h-10 w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete="street-address"
          onBlur={(e) => {
            const value = e.currentTarget.value.trim();
            if (!value) return;
            onSelectRef.current({
              street: value,
              city: "",
              state: "",
              zip: "",
            });
          }}
          disabled={disabled}
        />
      )}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-brand-warn/30 bg-brand-warn/5 px-3 py-2 text-xs text-brand-warn"
        >
          <p className="font-medium">Address autocomplete unavailable</p>
          <p className="mt-1 text-brand-muted">{error}</p>
          {apiKey ? (
            <ul className="mt-2 list-disc pl-4 text-[11px] text-brand-muted">
              <li>
                Enable a billing account on the Google Cloud project — Places API
                (New) needs one even for free-tier usage.
              </li>
              <li>
                Enable both <span className="font-mono">Places API</span> and{" "}
                <span className="font-mono">Places API (New)</span>.
              </li>
              <li>
                If the key has HTTP referrer restrictions, include the current
                Vercel preview + production domains.
              </li>
            </ul>
          ) : null}
        </div>
      ) : null}

      {ready && !error ? (
        <p className="text-[10px] uppercase tracking-wider text-brand-faint">
          Powered by Google
        </p>
      ) : null}
    </div>
  );
}

interface NewAddressComponent {
  types: string[];
  longText?: string;
  shortText?: string;
}

function parsePlace(place: {
  addressComponents?: NewAddressComponent[];
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number } | null;
}): AddressResult {
  const components = place.addressComponents ?? [];
  const get = (type: string, short = false): string => {
    const c = components.find((x) => x.types.includes(type));
    if (!c) return "";
    return short ? c.shortText ?? "" : c.longText ?? "";
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();

  const lat =
    typeof place.location?.lat === "function" ? place.location.lat() : undefined;
  const lng =
    typeof place.location?.lng === "function" ? place.location.lng() : undefined;

  return {
    street: street || place.formattedAddress || "",
    city: get("locality") || get("sublocality") || get("postal_town") || "",
    state: get("administrative_area_level_1", true),
    zip: get("postal_code"),
    lat,
    lng,
  };
}
