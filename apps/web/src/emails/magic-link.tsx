import {
  Html, Head, Preview, Body, Container, Section,
  Heading, Text, Button, Hr, Tailwind,
} from "@react-email/components";

interface Props { url: string; host: string; code?: string }

export default function MagicLinkEmail({ url, host, code }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your uatchit sign-in code{code ? `: ${code}` : ""}</Preview>
      <Tailwind>
        <Body className="bg-[#f6f7fb] font-sans">
          <Container className="mx-auto max-w-xl py-10 px-5">
            <Section className="bg-white rounded-xl p-8 border border-[#ececef]">
              <Heading className="text-2xl text-[#0a0a0b] m-0 mb-4 font-medium">
                Sign in to uatchit
              </Heading>

              {code && (
                <>
                  <Text className="text-sm text-[#4a4a55] leading-6 m-0 mb-3">
                    Enter this code in the uatchit side panel:
                  </Text>
                  <Text
                    className="m-0 mb-2 text-center font-mono font-semibold text-[#0a0a0b]"
                    style={{ fontSize: 36, letterSpacing: "0.35em", paddingLeft: "0.35em" }}
                  >
                    {code}
                  </Text>
                  <Text className="text-xs text-[#8a8a93] text-center m-0 mb-6">
                    Expires in 15 minutes · one-time use
                  </Text>
                  <Hr className="border-[#ececef] my-6" />
                </>
              )}

              <Text className="text-base text-[#4a4a55] leading-6 m-0 mb-6">
                Or click below to sign in on the web. This link expires in 24 hours and can only be used once.
              </Text>
              <Button
                href={url}
                className="bg-[#0a0a0b] text-white rounded-md px-6 py-3 text-sm no-underline block text-center box-border"
              >
                Sign in
              </Button>
              <Text className="text-xs text-[#8a8a93] mt-4 m-0 break-all">
                Or paste this URL into your browser: {url}
              </Text>
              <Hr className="border-[#ececef] my-6" />
              <Text className="text-xs text-[#8a8a93] m-0">
                Going to {host}. If you didn't request this, you can ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
