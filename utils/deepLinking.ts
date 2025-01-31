import { Linking } from "react-native"
import type { NavigationContainerRef } from "@react-navigation/native"
import type { RootStackParamList } from "../types/navigation"

export function initDeepLinking(navigationRef: NavigationContainerRef<RootStackParamList>) {
  const handleDeepLink = (event: { url: string }) => {
    const { url } = event
    handleUrl(url)
  }

  const handleUrl = (url: string) => {
    if (!url) return

    const route = url.replace(/.*?:\/\//g, "")
    const [path, queryString] = route.split("?")
    const params = queryString ? Object.fromEntries(new URLSearchParams(queryString).entries()) : {}

    switch (path) {
      case "challenge":
        if (params.month) {
          navigationRef.navigate("Challenge")
          // The challenge screen will handle the month parameter internally
        }
        break
      // Add more deep link handlers here
    }
  }

  // Handle deep link when app is not running and is launched by the deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleUrl(url)
    }
  })

  // Handle deep link when app is running
  Linking.addEventListener("url", handleDeepLink)

  return () => {
    Linking.removeAllListeners("url")
  }
}

export async function createChallengeDeepLink(month: number): Promise<string> {
  const baseUrl = "go2go2://challenge"
  const url = `${baseUrl}?month=${month}`

  const supported = await Linking.canOpenURL(url)
  if (!supported) {
    throw new Error("Deep linking is not supported")
  }

  return url
}

