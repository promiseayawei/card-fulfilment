import type { CardRecord } from '../types'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}:</span>{' '}
      <span className="field-value">{value || '________________'}</span>
    </div>
  )
}

export default function Template({ record }: { record: CardRecord }) {
  return (
    <div className="guide-page">
      <header className="guide-header">
        <div className="guide-header-top">
          <img src="/kegow-logo.jpeg" className="brand-logo" alt="Kegow" />
          <img src="/card-sample.png" className="card-sample" alt="Kegow Verve card sample" />
        </div>
        <div className="header-rule" />
      </header>

      <h1 className="guide-title">
        <span className="title-blue">CARD FULFILMENT AND </span>
        <span className="title-orange">ACTIVATION GUIDE</span>
      </h1>

      <p className="salutation">Dear <strong>{record.fullName || '<Name>'}</strong>,</p>

      <p className="intro">
        Thank you for choosing the Kegow Verve Debit Card, proudly powered by E-Networks Technologies Ltd.
        Your card is designed to provide a secure, convenient, and rewarding way to access financial
        services and perform everyday transactions. Through our innovative platform, E-Networks
        Technologies Ltd delivers smart identity-enabled payment solutions, allowing you to enjoy
        seamless financial transactions while accessing exclusive value-added benefits.
      </p>

      <div className="field-bar">
        <Field label="Default PIN" value={record.defaultPin} />
        <Field label="Account Number" value={record.accountNumber} />
        <Field label="Card No." value={record.cardNo} />
        <Field label="Gsap No." value={record.gsapNo} />
      </div>
      <div className="field-bar field-bar-second">
        <Field label="Caregiver" value={record.caregiver} />
        <Field label="School" value={record.school} />
      </div>

      <div className="guide-columns">
        <div className="guide-col">
          <section>
            <h2>Card Activation</h2>
            <p>To begin using your card, you will need to activate it by changing the default PIN.</p>
            <ol>
              <li>Visit the nearest Automated Teller Machine (ATM).</li>
              <li>Insert your card into the ATM.</li>
              <li>Enter the default PIN provided with your card.</li>
              <li>Select Change/Reset PIN from the menu.</li>
              <li>Enter your preferred new PIN (ensure it is secure and difficult to guess).</li>
              <li>Confirm your new PIN to complete the activation process.</li>
            </ol>
          </section>

          <section>
            <h2>Acceptance</h2>
            <p>
              Your card can be used for the purchase of goods and services on all Nigerian websites,
              Point of Sale (POS) terminals, and Automated Teller Machines (ATMs).
            </p>
          </section>

          <section>
            <h2>Purchase Options</h2>
            <ol>
              <li>Make cash withdrawals on any ATM.</li>
              <li>Pay bills (Airtime top-up, Data subscriptions, Electricity, etc.).</li>
              <li>Make in-store and online purchases.</li>
            </ol>
          </section>
        </div>

        <div className="guide-col">
          <section>
            <h2>Exclusive Value-Added Benefits</h2>
            <ul>
              <li>Smart Identity Solutions for secure and trusted digital identification.</li>
              <li>Seamless financial transactions with speed and reliability.</li>
              <li>One-off cashback reward of ₦1,000 for every successful referral.</li>
              <li>Ongoing transactional cashbacks on referrals for the validity period of the card.</li>
              <li>Discounted shopping at selected merchant locations within your neighbourhood and across Nigeria.</li>
            </ul>
          </section>

          <section>
            <h2>Important Security Tips</h2>
            <ul>
              <li>Always check your account balance before making any payment or purchase.</li>
              <li>Keep your PIN confidential and never share it with anyone.</li>
              <li>Change your PIN regularly for improved security.</li>
              <li>Ensure your SMS or email alerts are active to monitor all transactions.</li>
            </ul>
          </section>

          <section>
            <h2>Customer Support</h2>
            <p>For more enquiries or if your card is lost or stolen, please contact our customer care team immediately.</p>
            <p>
              Customer Care: <strong>+2348079664791</strong>
              <br />
              Email: <strong>support@kegow.com</strong>
              <br />
              Or call: +2348066254272, +2348066606755, +2348107351568
              <br />
              Email: <strong>cardsupport@enetworkspay.com</strong>
            </p>
          </section>
        </div>
      </div>

      <footer className="guide-footer">
        <p>Yours sincerely,</p>
        <img src="/kegow-signature.png" className="signature-img" alt="Signature" />
        <p className="signature">Kegow (by Chamsmobile)</p>
        <div className="footer-brands">
          <img src="/kegow-logo.jpeg" className="footer-logo" alt="Kegow" />
          <img src="/enetworks-logo.jpeg" className="footer-logo footer-logo-square" alt="E-Networks Technologies Ltd" />
        </div>
      </footer>
    </div>
  )
}
