"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddressResult } from "@/lib/types";

interface AddressAutocompleteProps {
  id?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  onSelect: (address: AddressResult) => void;
  disabled?: boolean;
}

// Wrapper around the Google Places Autocomplete widget. If the API key is
// missing we fall back to a plain text input so forms still work in dev —
// the parent keeps whatever typed string the user entered. Loading the
// Google SDK is deferred until mount so this component is SSR-safe.
export function AddressAutocomplete({
  id,
  label = "Address",
  defaultValue = "",
  placeholder = "Start typing an address…",
  onSelect,
  disabled,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [degraded, setDegraded] = React.useState(!apiKey);

  React.useEffect(() => {
    if (!apiKey) {
      setDegraded(true);
      return;
    }
    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;

    (async () => {
      try {
        const { Loader } = await import("@googlemaps/js-api-loader");
        const loader = new Loader({
          apiKey,
          libraries: ["places"],
          version: "weekly",
        });
        await loader.importLibrary("places");
        if (cancelled || !inputRef.current) return;

        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: ["us"] },
          fields: ["address_components", "formatted_address", "geometry"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          if (!place?.address_components) return;
          const parsed = parsePlace(place);
          if (inputRef.current) {
            inputRef.current.value = parsed.street;
          }
          onSelect(parsed);
        });

        setReady(true);
      } catch (err) {
        console.error("[address-autocomplete] failed to load Google Places", err);
        setDegraded(true);
      }
    })();

    return () => {
      cancelled = true;
      if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [apiKey, onSelect]);

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Input
        id={id}
        ref={inputRef}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="street-address"
        disabled={disabled}
      />
      {degraded ? (
        <p className="text-xs text-brand-warn">
          Address autocomplete unavailable — set{" "}
          <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          to enable. You can still type the address manually.
        </p>
      ) : null}
      {ready ? (
        <p className="text-[10px] uppercase tracking-wider text-brand-faint">
          Powered by Google
        </p>
      ) : null}
    </div>
  );
}

function parsePlace(
  place: google.maps.places.PlaceResult,
): AddressResult {
  const components = place.address_components ?? [];
  const get = (type: string, short = false): string => {
    const c = components.find((x) => x.types.includes(type));
    if (!c) return "";
    return short ? c.short_name : c.long_name;
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();

  return {
    street: street || place.formatted_address || "",
    city: get("locality") || get("sublocality") || "",
    state: get("administrative_area_level_1", true),
    zip: get("postal_code"),
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng(),
  };
}
